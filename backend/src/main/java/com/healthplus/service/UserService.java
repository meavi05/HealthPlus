package com.healthplus.service;

import com.healthplus.dto.UserUpdateRequest;
import com.healthplus.model.UserDeliveryAddress;
import com.healthplus.model.UserPaymentMethod;
import com.healthplus.model.UserProfile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {
    private final JdbcTemplate jdbcTemplate;

    public UserService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<UserProfile> getUser(Long userId) {
        List<UserProfile> users = jdbcTemplate.query(
                "SELECT id, email, name, profile_picture FROM users WHERE id = ?",
                (rs, rowNum) -> new UserProfile(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("name"),
                        rs.getString("profile_picture")
                ),
                userId
        );
        return users.stream().findFirst();
    }

    public java.util.List<UserPaymentMethod> getPaymentMethods(Long userId) {
        return jdbcTemplate.query(
                "SELECT id, user_id, provider, upi_vpa, is_verified, status FROM user_payment_methods WHERE user_id = ? AND status = 'active'",
                (rs, rowNum) -> new UserPaymentMethod(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("provider"),
                        rs.getString("upi_vpa"),
                        rs.getInt("is_verified") == 1,
                        rs.getString("status")
                ),
                userId
        );
    }

    public List<UserDeliveryAddress> getDeliveryAddresses(Long userId) {
        return jdbcTemplate.query(
                """
                SELECT id, user_id, full_name, phone, line1, line2, city, state, pincode, landmark, is_default
                FROM user_delivery_addresses
                WHERE user_id = ?
                ORDER BY is_default DESC, id DESC
                """,
                (rs, rowNum) -> new UserDeliveryAddress(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("full_name"),
                        rs.getString("phone"),
                        rs.getString("line1"),
                        rs.getString("line2"),
                        rs.getString("city"),
                        rs.getString("state"),
                        rs.getString("pincode"),
                        rs.getString("landmark"),
                        rs.getInt("is_default") == 1
                ),
                userId
        );
    }

    public Long createDeliveryAddress(Long userId,
                                      String fullName,
                                      String phone,
                                      String line1,
                                      String line2,
                                      String city,
                                      String state,
                                      String pincode,
                                      String landmark,
                                      boolean asDefault) {
        if (asDefault) {
            jdbcTemplate.update("UPDATE user_delivery_addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", userId);
        } else {
            Integer existingCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_delivery_addresses WHERE user_id = ?",
                    Integer.class,
                    userId
            );
            if (existingCount == null || existingCount == 0) {
                asDefault = true;
            }
        }

        final boolean shouldBeDefault = asDefault;

        org.springframework.jdbc.support.GeneratedKeyHolder keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            java.sql.PreparedStatement ps = connection.prepareStatement(
                    """
                    INSERT INTO user_delivery_addresses
                    (user_id, full_name, phone, line1, line2, city, state, pincode, landmark, is_default, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    java.sql.Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, userId);
            ps.setString(2, fullName);
            ps.setString(3, phone);
            ps.setString(4, line1);
            ps.setString(5, line2);
            ps.setString(6, city);
            ps.setString(7, state);
            ps.setString(8, pincode);
            ps.setString(9, landmark);
            ps.setInt(10, shouldBeDefault ? 1 : 0);
            return ps;
        }, keyHolder);

        if (keyHolder.getKey() == null) {
            throw new IllegalStateException("Failed to create delivery address");
        }
        return keyHolder.getKey().longValue();
    }

    public boolean userOwnsDeliveryAddress(Long userId, Long addressId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_delivery_addresses WHERE id = ? AND user_id = ?",
                Integer.class,
                addressId,
                userId
        );
        return count != null && count > 0;
    }

    public void registerPaymentMethod(Long userId, String provider, String upiVpa) {
        jdbcTemplate.update(
                """
                INSERT INTO user_payment_methods (user_id, provider, upi_vpa, is_verified, status, updated_at)
                VALUES (?, ?, ?, 1, 'active', CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, provider) WHERE status = 'active'
                DO UPDATE SET upi_vpa = excluded.upi_vpa, is_verified = 1, updated_at = CURRENT_TIMESTAMP
                """,
                userId,
                provider,
                upiVpa
        );
    }

    public boolean hasVerifiedPaymentMethod(Long userId, String provider) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_payment_methods WHERE user_id = ? AND provider = ? AND status = 'active' AND is_verified = 1",
                Integer.class,
                userId,
                provider
        );
        return count != null && count > 0;
    }

    public void updateUser(Long userId, UserUpdateRequest request) {
        jdbcTemplate.update(
                "UPDATE users SET name = ?, email = ?, profile_picture = ? WHERE id = ?",
                request.name(),
                request.email(),
                request.profilePicture(),
                userId
        );
    }
}
