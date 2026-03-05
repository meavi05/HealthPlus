package com.healthplus.service;

import com.healthplus.dto.MedicinesResponse;
import com.healthplus.model.Medicine;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class MedicineService {
    private final JdbcTemplate jdbcTemplate;

    public MedicineService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public MedicinesResponse getMedicines(int page, int limit) {
        int offset = (page - 1) * limit;
        List<Medicine> medicines = jdbcTemplate.query(
                """
                SELECT id, name, description, price, stock,
                       COALESCE(category, 'General') AS category,
                       COALESCE(brand, 'HealthPlus') AS brand,
                       COALESCE(mrp, price) AS mrp,
                       COALESCE(discount_percent, 0) AS discount_percent,
                       COALESCE(requires_prescription, 0) AS requires_prescription,
                       COALESCE(rating, 4.0) AS rating,
                       COALESCE(image_url, '') AS image_url,
                       COALESCE(delivery_eta, 'Today') AS delivery_eta
                FROM medicines
                LIMIT ? OFFSET ?
                """,
                (rs, rowNum) -> new Medicine(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getDouble("price"),
                        rs.getInt("stock"),
                        rs.getString("category"),
                        rs.getString("brand"),
                        rs.getDouble("mrp"),
                        rs.getInt("discount_percent"),
                        rs.getInt("requires_prescription") == 1,
                        rs.getDouble("rating"),
                        rs.getString("image_url"),
                        rs.getString("delivery_eta")
                ),
                limit,
                offset
        );

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM medicines", Long.class);
        return new MedicinesResponse(medicines, total == null ? 0 : total, page, limit);
    }

    public List<Map<String, Object>> getCategories() {
        return jdbcTemplate.queryForList(
                "SELECT DISTINCT COALESCE(category, 'General') as name FROM medicines ORDER BY name"
        );
    }

    public List<Map<String, Object>> getBrands() {
        return jdbcTemplate.queryForList(
                "SELECT DISTINCT COALESCE(brand, 'HealthPlus') as name FROM medicines ORDER BY name"
        );
    }

    public List<Map<String, Object>> suggest(String query) {
        String q = "%" + query.toLowerCase() + "%";
        return jdbcTemplate.queryForList(
                "SELECT id, name FROM medicines WHERE lower(name) LIKE ? ORDER BY name LIMIT 8",
                q
        );
    }

    public Optional<Medicine> getMedicineById(Long id) {
        List<Medicine> medicines = jdbcTemplate.query(
                """
                SELECT id, name, description, price, stock,
                       COALESCE(category, 'General') AS category,
                       COALESCE(brand, 'HealthPlus') AS brand,
                       COALESCE(mrp, price) AS mrp,
                       COALESCE(discount_percent, 0) AS discount_percent,
                       COALESCE(requires_prescription, 0) AS requires_prescription,
                       COALESCE(rating, 4.0) AS rating,
                       COALESCE(image_url, '') AS image_url,
                       COALESCE(delivery_eta, 'Today') AS delivery_eta
                FROM medicines
                WHERE id = ?
                """,
                (rs, rowNum) -> new Medicine(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getDouble("price"),
                        rs.getInt("stock"),
                        rs.getString("category"),
                        rs.getString("brand"),
                        rs.getDouble("mrp"),
                        rs.getInt("discount_percent"),
                        rs.getInt("requires_prescription") == 1,
                        rs.getDouble("rating"),
                        rs.getString("image_url"),
                        rs.getString("delivery_eta")
                ),
                id
        );
        return medicines.stream().findFirst();
    }

    public List<Map<String, Object>> getSubstitutes(Long id) {
        return jdbcTemplate.queryForList(
                """
                SELECT m2.id, m2.name, m2.price
                FROM medicines m1
                JOIN medicines m2 ON COALESCE(m1.category, 'General') = COALESCE(m2.category, 'General')
                WHERE m1.id = ? AND m2.id != m1.id
                LIMIT 6
                """,
                id
        );
    }
}
