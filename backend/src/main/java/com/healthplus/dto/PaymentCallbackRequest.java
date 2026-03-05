package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PaymentCallbackRequest(
        String status,
        @JsonProperty("transaction_ref") String transactionRef
) {}
