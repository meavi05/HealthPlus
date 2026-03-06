package com.healthplus.security;

public record LocalUser(Long id, String email, String name, String profilePicture, String role) {}
