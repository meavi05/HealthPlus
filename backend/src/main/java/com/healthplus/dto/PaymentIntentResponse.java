package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PaymentIntentResponse(
        Long id,
        String status,
        @JsonProperty("transaction_ref") String transactionRef,
        @JsonProperty("callback_token") String callbackToken
) {}
