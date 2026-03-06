package com.healthplus.controller;

import com.healthplus.dto.CreatePaymentIntentRequest;
import com.healthplus.dto.PaymentCallbackRequest;
import com.healthplus.dto.PaymentIntentResponse;
import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import com.healthplus.service.PaymentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentsController {
    private final PaymentService paymentService;
    private final LocalUserService localUserService;

    public PaymentsController(PaymentService paymentService, LocalUserService localUserService) {
        this.paymentService = paymentService;
        this.localUserService = localUserService;
    }

    @PostMapping("/intents")
    public ResponseEntity<?> createIntent(Authentication authentication, @RequestBody CreatePaymentIntentRequest request) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            CreatePaymentIntentRequest normalized = new CreatePaymentIntentRequest(
                    current.id(),
                    request.paymentMethod(),
                    request.amount()
            );
            PaymentIntentResponse response = paymentService.createIntent(normalized);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/intents/{intentId}/callback")
    public ResponseEntity<?> callback(@PathVariable Long intentId, @RequestBody PaymentCallbackRequest request) {
        try {
            PaymentIntentResponse response = paymentService.handleIntentCallback(intentId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
