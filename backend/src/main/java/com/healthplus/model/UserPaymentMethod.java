package com.healthplus.model;

public record UserPaymentMethod(Long id, Long userId, String provider, String upiVpa, Boolean verified, String status) {}
