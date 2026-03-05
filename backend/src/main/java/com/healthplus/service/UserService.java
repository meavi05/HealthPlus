package com.healthplus.service;

import com.healthplus.dto.UserUpdateRequest;
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
