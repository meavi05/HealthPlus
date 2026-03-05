package com.healthplus.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class MeController {
    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Not authenticated"));
        }

        if (authentication instanceof OAuth2AuthenticationToken oauthToken && oauthToken.getPrincipal() instanceof OAuth2User oauthUser) {
            Map<String, Object> attributes = oauthUser.getAttributes();
            String provider = oauthToken.getAuthorizedClientRegistrationId();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", attributes.getOrDefault("sub", attributes.getOrDefault("id", authentication.getName())));
            payload.put("name", attributes.getOrDefault("name", authentication.getName()));
            payload.put("email", attributes.getOrDefault("email", null));
            payload.put("profile_picture", attributes.getOrDefault("picture", null));
            payload.put("given_name", attributes.getOrDefault("given_name", null));
            payload.put("family_name", attributes.getOrDefault("family_name", null));
            payload.put("locale", attributes.getOrDefault("locale", null));
            payload.put("email_verified", attributes.getOrDefault("email_verified", null));
            payload.put("provider", provider);
            payload.put("provider_user_id", attributes.getOrDefault("sub", attributes.getOrDefault("id", null)));
            payload.put("oauth_attributes", attributes);
            return ResponseEntity.ok(payload);
        }

        return ResponseEntity.ok(Map.of(
                "id", authentication.getName(),
                "name", authentication.getName(),
                "provider", "session"
        ));
    }
}
