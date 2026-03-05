package com.healthplus.model;

public record PaymentIntentView(
        Long id,
        Long userId,
        String provider,
        Double amount,
        String status,
        String transactionRef,
        String callbackToken,
        String createdAt,
        String updatedAt
) {}
