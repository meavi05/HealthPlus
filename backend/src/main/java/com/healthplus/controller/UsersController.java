package com.healthplus.controller;

import com.healthplus.dto.UserUpdateRequest;
import com.healthplus.model.UserProfile;
import com.healthplus.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
public class UsersController {
    private final UserService userService;

    public UsersController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUser(@PathVariable Long userId) {
        return userService.getUser(userId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "User not found")));
    }


    @GetMapping("/{userId}/payment-methods")
    public ResponseEntity<?> getPaymentMethods(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getPaymentMethods(userId));
    }

    @PostMapping("/{userId}/payment-methods")
    public ResponseEntity<?> registerPaymentMethod(@PathVariable Long userId, @RequestBody Map<String, String> request) {
        String provider = request.getOrDefault("provider", "").trim().toLowerCase();
        String upiVpa = request.getOrDefault("upi_vpa", "").trim();

        if (!Set.of("gpay", "phonepe").contains(provider)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unsupported payment provider"));
        }

        if (upiVpa.isBlank() || !upiVpa.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid UPI ID is required"));
        }

        userService.registerPaymentMethod(userId, provider, upiVpa);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Payment method registered"));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable Long userId, @RequestBody UserUpdateRequest request) {
        if (request.email() == null || request.email().isBlank() || request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Name and email are required"));
        }

        userService.updateUser(userId, request);
        return ResponseEntity.ok(Map.of("message", "Profile updated successfully"));
    }
}
