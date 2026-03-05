package com.healthplus.service;

import com.healthplus.dto.MedicinesResponse;
import com.healthplus.model.Medicine;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MedicineService {
    private final JdbcTemplate jdbcTemplate;

    public MedicineService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public MedicinesResponse getMedicines(int page, int limit) {
        int offset = (page - 1) * limit;
        List<Medicine> medicines = jdbcTemplate.query(
                "SELECT id, name, description, price, stock FROM medicines LIMIT ? OFFSET ?",
                (rs, rowNum) -> new Medicine(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getDouble("price"),
                        rs.getInt("stock")
                ),
                limit,
                offset
        );

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM medicines", Long.class);
        return new MedicinesResponse(medicines, total == null ? 0 : total, page, limit);
    }
}
