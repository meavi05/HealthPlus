package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record CreateOrderRequest(
        @JsonProperty("user_id") Long userId,
        @JsonProperty("payment_method") String paymentMethod,
        List<CreateOrderItemRequest> items,
        @JsonProperty("total_price") Double totalPrice
) {}
