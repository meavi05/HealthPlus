package com.healthplus.controller;

import com.healthplus.dto.CreatePaymentIntentRequest;
import com.healthplus.dto.PaymentCallbackRequest;
import com.healthplus.dto.PaymentIntentResponse;
import com.healthplus.service.PaymentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentsController {
    private final PaymentService paymentService;

    public PaymentsController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/intents")
    public ResponseEntity<?> createIntent(@RequestBody CreatePaymentIntentRequest request) {
        try {
            PaymentIntentResponse response = paymentService.createIntent(request);
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
