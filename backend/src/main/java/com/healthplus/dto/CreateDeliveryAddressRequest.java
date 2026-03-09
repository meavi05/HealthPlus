package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CreateDeliveryAddressRequest(
        @JsonProperty("full_name") String fullName,
        String phone,
        String line1,
        String line2,
        String city,
        String state,
        String pincode,
        String landmark,
        @JsonProperty("is_default") Boolean isDefault
) {}
