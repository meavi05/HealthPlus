package com.healthplus.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@Service
public class MedicineRoutineService {
    private final JdbcTemplate jdbcTemplate;

    public MedicineRoutineService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> getRoutines(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("user_id is required");
        }

        Integer userCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE id = ?",
                Integer.class,
                userId
        );
        if (userCount == null || userCount == 0) {
            throw new IllegalArgumentException("User not found");
        }

        return jdbcTemplate.queryForList(
                "SELECT id, user_id, medicine_name, last_taken_date, next_due_date, status, created_at FROM medicine_routines WHERE user_id = ? ORDER BY id DESC",
                userId
        );
    }

    public Map<String, Object> createRoutine(Long userId, String medicineName, String lastTakenDateRaw) {
        if (userId == null) {
            throw new IllegalArgumentException("user_id is required");
        }
        Integer userCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE id = ?",
                Integer.class,
                userId
        );
        if (userCount == null || userCount == 0) {
            throw new IllegalArgumentException("User not found");
        }

        if (medicineName == null || medicineName.isBlank()) {
            throw new IllegalArgumentException("medicine_name is required");
        }
        if (lastTakenDateRaw == null || lastTakenDateRaw.isBlank()) {
            throw new IllegalArgumentException("last_taken_date is required");
        }

        LocalDate lastTakenDate;
        try {
            lastTakenDate = LocalDate.parse(lastTakenDateRaw);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("last_taken_date must be in YYYY-MM-DD format");
        }

        LocalDate nextDueDate = lastTakenDate.plusDays(30);

        jdbcTemplate.update(
                "INSERT INTO medicine_routines (user_id, medicine_name, last_taken_date, next_due_date, status, updated_at) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)",
                userId,
                medicineName.trim(),
                lastTakenDate.toString(),
                nextDueDate.toString()
        );

        return Map.of(
                "user_id", userId,
                "medicine_name", medicineName.trim(),
                "last_taken_date", lastTakenDate.toString(),
                "next_due_date", nextDueDate.toString(),
                "status", "active"
        );
    }
}
