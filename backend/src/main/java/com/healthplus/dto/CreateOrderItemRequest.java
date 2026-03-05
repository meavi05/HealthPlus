package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CreateOrderItemRequest(
        @JsonProperty("medicine_id") Long medicineId,
        Integer quantity,
        Double price
) {}
