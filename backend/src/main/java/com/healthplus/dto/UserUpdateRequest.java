package com.healthplus.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserUpdateRequest(String name, String email, @JsonProperty("profile_picture") String profilePicture) {}
