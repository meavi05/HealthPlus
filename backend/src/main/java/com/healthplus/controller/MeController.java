package com.healthplus.controller;

import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class MeController {
    private final LocalUserService localUserService;

    public MeController(LocalUserService localUserService) {
        this.localUserService = localUserService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        try {
            LocalUser user = localUserService.resolveOrCreate(authentication);
            return ResponseEntity.ok(localUserService.toPayload(user));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Not authenticated"));
        }
    }
}
