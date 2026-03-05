package com.healthplus.model;

import java.util.List;

public record OrderView(
        Long id,
        Long userId,
        Double totalPrice,
        String status,
        String createdAt,
        String paymentStatus,
        String transactionRef,
        List<OrderItemView> items
) {}
