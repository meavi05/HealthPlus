package com.healthplus.service;

import com.healthplus.dto.UserUpdateRequest;
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
