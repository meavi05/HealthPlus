package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CreatePaymentIntentRequest(
        @JsonProperty("user_id") Long userId,
        @JsonProperty("payment_method") String paymentMethod,
        Double amount
) {}
