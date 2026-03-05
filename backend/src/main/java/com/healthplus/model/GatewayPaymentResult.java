package com.healthplus.model;

public record GatewayPaymentResult(String status, String transactionRef, String gatewayReference) {}
