package com.healthplus.controller;

import com.healthplus.dto.UserUpdateRequest;
import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import com.healthplus.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
public class UsersController {
    private final UserService userService;
    private final LocalUserService localUserService;

    public UsersController(UserService userService, LocalUserService localUserService) {
        this.userService = userService;
        this.localUserService = localUserService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        LocalUser current = localUserService.resolveOrCreate(authentication);
        return userService.getUser(current.id())
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "User not found")));
    }

    @GetMapping("/me/payment-methods")
    public ResponseEntity<?> getPaymentMethods(Authentication authentication) {
        LocalUser current = localUserService.resolveOrCreate(authentication);
        return ResponseEntity.ok(userService.getPaymentMethods(current.id()));
    }

    @PostMapping("/me/payment-methods")
    public ResponseEntity<?> registerPaymentMethod(Authentication authentication, @RequestBody Map<String, String> request) {
        LocalUser current = localUserService.resolveOrCreate(authentication);
        String provider = request.getOrDefault("provider", "").trim().toLowerCase();
        String upiVpa = request.getOrDefault("upi_vpa", "").trim();

        if (!Set.of("gpay", "phonepe").contains(provider)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unsupported payment provider"));
        }

        if (upiVpa.isBlank() || !upiVpa.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid UPI ID is required"));
        }

        userService.registerPaymentMethod(current.id(), provider, upiVpa);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Payment method registered"));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateCurrentUser(Authentication authentication, @RequestBody UserUpdateRequest request) {
        LocalUser current = localUserService.resolveOrCreate(authentication);

        if (request.email() == null || request.email().isBlank() || request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Name and email are required"));
        }

        userService.updateUser(current.id(), request);
        return ResponseEntity.ok(Map.of("message", "Profile updated successfully"));
    }
}
