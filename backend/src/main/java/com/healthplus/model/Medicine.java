package com.healthplus.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record Medicine(
        Long id,
        String name,
        String description,
        Double price,
        Integer stock,
        String category,
        String brand,
        Double mrp,
        @JsonProperty("discount_percent") Integer discountPercent,
        @JsonProperty("requires_prescription") Boolean requiresPrescription,
        Double rating,
        @JsonProperty("image_url") String imageUrl,
        @JsonProperty("delivery_eta") String deliveryEta
) {}
