package com.healthplus.model;

public record UserDeliveryAddress(
        Long id,
        Long userId,
        String fullName,
        String phone,
        String line1,
        String line2,
        String city,
        String state,
        String pincode,
        String landmark,
        Boolean isDefault
) {}
