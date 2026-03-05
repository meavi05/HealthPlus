package com.healthplus.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class MeController {
    private final JdbcTemplate jdbcTemplate;

    public MeController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Not authenticated"));
        }

        if (authentication instanceof OAuth2AuthenticationToken oauthToken && oauthToken.getPrincipal() instanceof OAuth2User oauthUser) {
            Map<String, Object> attributes = oauthUser.getAttributes();
            Object providerUserId = attributes.getOrDefault("sub", attributes.getOrDefault("id", authentication.getName()));
            String name = String.valueOf(attributes.getOrDefault("name", authentication.getName()));
            String email = normalizeEmail(attributes.get("email"), providerUserId);
            String profilePicture = extractProfilePicture(attributes);
            Long localUserId = ensureLocalUser(email, name, profilePicture);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", localUserId);
            payload.put("provider_user_id", providerUserId);
            payload.put("name", name);
            payload.put("email", email);
            payload.put("profile_picture", profilePicture);
            return ResponseEntity.ok(payload);
        }

        String name = authentication.getName();
        String email = normalizeEmail(authentication.getName(), authentication.getName());
        Long localUserId = ensureLocalUser(email, name, "");

        return ResponseEntity.ok(Map.of(
                "id", localUserId,
                "name", name,
                "email", email,
                "profile_picture", ""
        ));
    }

    private String normalizeEmail(Object rawEmail, Object fallbackSeed) {
        if (rawEmail instanceof String email && !email.isBlank() && email.contains("@")) {
            return email.trim().toLowerCase();
        }
        return String.valueOf(fallbackSeed) + "@oauth.local";
    }

    private Long ensureLocalUser(String email, String name, String profilePicture) {
        List<Long> existing = jdbcTemplate.query(
                "SELECT id FROM users WHERE email = ?",
                (rs, rowNum) -> rs.getLong("id"),
                email
        );

        if (!existing.isEmpty()) {
            jdbcTemplate.update(
                    "UPDATE users SET name = ?, profile_picture = ? WHERE id = ?",
                    name,
                    profilePicture,
                    existing.get(0)
            );
            return existing.get(0);
        }

        jdbcTemplate.update(
                "INSERT INTO users (email, name, profile_picture) VALUES (?, ?, ?)",
                email,
                name,
                profilePicture
        );

        List<Long> inserted = jdbcTemplate.query(
                "SELECT id FROM users WHERE email = ?",
                (rs, rowNum) -> rs.getLong("id"),
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
