package com.healthplus.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class LocalUserService {
    private final JdbcTemplate jdbcTemplate;

    public LocalUserService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public LocalUser resolveOrCreate(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            throw new IllegalArgumentException("Not authenticated");
        }

        if (authentication instanceof OAuth2AuthenticationToken oauthToken && oauthToken.getPrincipal() instanceof OAuth2User oauthUser) {
            Map<String, Object> attributes = oauthUser.getAttributes();
            Object providerUserId = attributes.getOrDefault("sub", attributes.getOrDefault("id", authentication.getName()));
            String name = String.valueOf(attributes.getOrDefault("name", authentication.getName()));
            String email = normalizeEmail(attributes.get("email"), providerUserId);
            String profilePicture = extractProfilePicture(attributes);
            return ensureLocalUser(email, name, profilePicture);
        }

        String name = authentication.getName();
        String email = normalizeEmail(authentication.getName(), authentication.getName());
        return ensureLocalUser(email, name, "");
    }

    public String roleForEmail(String email) {
        List<String> rows = jdbcTemplate.query(
                "SELECT role FROM users WHERE email = ?",
                (rs, rowNum) -> rs.getString("role"),
                email
        );
        return rows.isEmpty() ? "ROLE_USER" : rows.get(0);
    }

    public Map<String, Object> toPayload(LocalUser user) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", user.id());
        payload.put("name", user.name());
        payload.put("email", user.email());
        payload.put("profile_picture", user.profilePicture());
        payload.put("role", user.role());
        return payload;
    }

    private String normalizeEmail(Object rawEmail, Object fallbackSeed) {
        if (rawEmail instanceof String email && !email.isBlank() && email.contains("@")) {
            return email.trim().toLowerCase();
        }
        return String.valueOf(fallbackSeed) + "@oauth.local";
    }

    private LocalUser ensureLocalUser(String email, String name, String profilePicture) {
        List<LocalUser> existing = jdbcTemplate.query(
                "SELECT id, email, name, profile_picture, role FROM users WHERE email = ?",
                (rs, rowNum) -> new LocalUser(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("name"),
                        rs.getString("profile_picture"),
                        rs.getString("role")
                ),
                email
        );

        if (!existing.isEmpty()) {
            LocalUser current = existing.get(0);
            jdbcTemplate.update(
                    "UPDATE users SET name = ?, profile_picture = ? WHERE id = ?",
                    name,
                    profilePicture,
                    current.id()
            );
            return new LocalUser(current.id(), current.email(), name, profilePicture, current.role());
        }

        jdbcTemplate.update(
                "INSERT INTO users (email, name, profile_picture, role) VALUES (?, ?, ?, 'ROLE_USER')",
                email,
                name,
                profilePicture
        );

        List<LocalUser> inserted = jdbcTemplate.query(
                "SELECT id, email, name, profile_picture, role FROM users WHERE email = ?",
                (rs, rowNum) -> new LocalUser(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("name"),
                        rs.getString("profile_picture"),
                        rs.getString("role")
                ),
                email
        );

        if (inserted.isEmpty()) {
            throw new IllegalStateException("Unable to create local user profile");
        }
        return inserted.get(0);
    }

    private String extractProfilePicture(Map<String, Object> attributes) {
        Object picture = attributes.get("picture");
        if (picture instanceof String pictureUrl && !pictureUrl.isBlank()) {
            return pictureUrl;
        }

        if (picture instanceof Map<?, ?> pictureMap) {
            Object data = pictureMap.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object url = dataMap.get("url");
                if (url instanceof String stringUrl && !stringUrl.isBlank()) {
                    return stringUrl;
                }
            }
        }

        Object avatar = attributes.get("avatar_url");
        if (avatar instanceof String avatarUrl && !avatarUrl.isBlank()) {
            return avatarUrl;
        }

        return "";
    }
}
