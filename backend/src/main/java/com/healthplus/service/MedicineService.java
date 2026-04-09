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
                WITH base AS (
                    SELECT *,
                           COALESCE(NULLIF(TRIM(medicine_name), ''), '') AS name_value,
                           COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified') AS brand_value,
                           lower(COALESCE(NULLIF(TRIM(medicine_name), ''), '')) AS name_key,
                           lower(COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified')) AS brand_key
                    FROM medicine_inventory_details
                ),
                latest AS (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY name_key, brand_key ORDER BY id DESC) AS rn
                    FROM base
                    WHERE name_key <> ''
                ),
                summary AS (
                    SELECT name_key,
                           brand_key,
                           MAX(COALESCE(mrp, 0)) AS max_mrp
                    FROM base
                    WHERE name_key <> ''
                    GROUP BY name_key, brand_key
                )
                SELECT
                    l.medicine_id AS id,
                    l.name_value AS name,
                    COALESCE(l.medicine_description, '') AS description,
                    COALESCE(l.medicine_description, '') AS medicine_description,
                    COALESCE(l.medicine_uses, '') AS medicine_uses,
                    COALESCE(l.medicine_doses, '') AS medicine_doses,
                    ROUND(COALESCE(l.effective_cost_price, l.rate, l.mrp, 0), 2) AS price,
                    COALESCE(m.stock, 0) AS stock,
                    COALESCE(NULLIF(TRIM(l.pack), ''), '') AS pack,
                    COALESCE(NULLIF(TRIM(l.medicine_category), ''), 'General') AS category,
                    l.brand_value AS brand,
                    ROUND(COALESCE(NULLIF(s.max_mrp, 0), l.mrp, l.rate, l.effective_cost_price, 0), 2) AS mrp,
                    0 AS discount_percent,
                    0 AS requires_prescription,
                    4.0 AS rating,
                    '' AS image_url,
                    'Today' AS delivery_eta
                FROM latest l
                JOIN medicines m ON m.id = l.medicine_id
                JOIN summary s ON s.name_key = l.name_key AND s.brand_key = l.brand_key
                WHERE l.rn = 1
                ORDER BY l.id DESC
                LIMIT ? OFFSET ?
                """,
                (rs, rowNum) -> new Medicine(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getString("medicine_description"),
                        rs.getString("medicine_uses"),
                        rs.getString("medicine_doses"),
                        rs.getDouble("price"),
                        rs.getInt("stock"),
                        rs.getString("pack"),
                        formatPackSplitStock(rs.getInt("stock"), rs.getString("pack")),
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

        Long total = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM (
                    SELECT 1
                    FROM medicine_inventory_details
                    WHERE COALESCE(TRIM(medicine_name), '') <> ''
                    GROUP BY lower(TRIM(medicine_name)), lower(COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified'))
                ) grouped
                """,
                Long.class
        );
        return new MedicinesResponse(medicines, total == null ? 0 : total, page, limit);
    }

    public List<Map<String, Object>> getCategories() {
        return jdbcTemplate.queryForList(
                """
                SELECT DISTINCT COALESCE(NULLIF(TRIM(medicine_category), ''), 'General') as name
                FROM medicine_inventory_details
                WHERE COALESCE(TRIM(medicine_name), '') <> ''
                ORDER BY name
                """
        );
    }

    public List<Map<String, Object>> getBrands() {
        return jdbcTemplate.queryForList(
                """
                SELECT DISTINCT COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified') as name
                FROM medicine_inventory_details
                WHERE COALESCE(TRIM(medicine_name), '') <> ''
                ORDER BY name
                """
        );
    }

    public List<Map<String, Object>> suggest(String query) {
        String q = "%" + query.toLowerCase() + "%";
        return jdbcTemplate.queryForList(
                """
                WITH base AS (
                    SELECT *,
                           COALESCE(NULLIF(TRIM(medicine_name), ''), '') AS name_value,
                           COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified') AS brand_value,
                           lower(COALESCE(NULLIF(TRIM(medicine_name), ''), '')) AS name_key,
                           lower(COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified')) AS brand_key
                    FROM medicine_inventory_details
                ),
                latest AS (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY name_key, brand_key ORDER BY id DESC) AS rn
                    FROM base
                    WHERE name_key <> ''
                )
                SELECT medicine_id AS id, name_value AS name
                FROM latest
                WHERE rn = 1
                  AND lower(name_value) LIKE ?
                ORDER BY name
                LIMIT 8
                """,
                q
        );
    }

    public Optional<Medicine> getMedicineById(Long id) {
        List<Medicine> medicines = jdbcTemplate.query(
                """
                WITH base AS (
                    SELECT *,
                           COALESCE(NULLIF(TRIM(medicine_name), ''), '') AS name_value,
                           COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified') AS brand_value,
                           lower(COALESCE(NULLIF(TRIM(medicine_name), ''), '')) AS name_key,
                           lower(COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified')) AS brand_key
                    FROM medicine_inventory_details
                ),
                target AS (
                    SELECT name_key, brand_key
                    FROM base
                    WHERE medicine_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                ),
                latest AS (
                    SELECT b.*,
                           ROW_NUMBER() OVER (PARTITION BY b.name_key, b.brand_key ORDER BY b.id DESC) AS rn
                    FROM base b
                    JOIN target t ON t.name_key = b.name_key AND t.brand_key = b.brand_key
                ),
                summary AS (
                    SELECT b.name_key,
                           b.brand_key,
                           MAX(COALESCE(b.mrp, 0)) AS max_mrp
                    FROM base b
                    JOIN target t ON t.name_key = b.name_key AND t.brand_key = b.brand_key
                    GROUP BY b.name_key, b.brand_key
                )
                SELECT
                    l.medicine_id AS id,
                    l.name_value AS name,
                    COALESCE(l.medicine_description, '') AS description,
                    COALESCE(l.medicine_description, '') AS medicine_description,
                    COALESCE(l.medicine_uses, '') AS medicine_uses,
                    COALESCE(l.medicine_doses, '') AS medicine_doses,
                    ROUND(COALESCE(l.effective_cost_price, l.rate, l.mrp, 0), 2) AS price,
                    COALESCE(m.stock, 0) AS stock,
                    COALESCE(NULLIF(TRIM(l.pack), ''), '') AS pack,
                    COALESCE(NULLIF(TRIM(l.medicine_category), ''), 'General') AS category,
                    l.brand_value AS brand,
                    ROUND(COALESCE(NULLIF(s.max_mrp, 0), l.mrp, l.rate, l.effective_cost_price, 0), 2) AS mrp,
                    0 AS discount_percent,
                    0 AS requires_prescription,
                    4.0 AS rating,
                    '' AS image_url,
                    'Today' AS delivery_eta
                FROM latest l
                JOIN medicines m ON m.id = l.medicine_id
                JOIN summary s ON s.name_key = l.name_key AND s.brand_key = l.brand_key
                WHERE l.rn = 1
                """,
                (rs, rowNum) -> new Medicine(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getString("medicine_description"),
                        rs.getString("medicine_uses"),
                        rs.getString("medicine_doses"),
                        rs.getDouble("price"),
                        rs.getInt("stock"),
                        rs.getString("pack"),
                        formatPackSplitStock(rs.getInt("stock"), rs.getString("pack")),
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
                WITH base AS (
                    SELECT *,
                           COALESCE(NULLIF(TRIM(medicine_name), ''), '') AS name_value,
                           COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified') AS brand_value,
                           lower(COALESCE(NULLIF(TRIM(medicine_name), ''), '')) AS name_key,
                           lower(COALESCE(NULLIF(TRIM(brand), ''), 'Unspecified')) AS brand_key
                    FROM medicine_inventory_details
                ),
                target AS (
                    SELECT name_key,
                           brand_key,
                           COALESCE(NULLIF(TRIM(medicine_category), ''), 'General') AS category
                    FROM base
                    WHERE medicine_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                ),
                latest AS (
                    SELECT b.*,
                           ROW_NUMBER() OVER (PARTITION BY b.name_key, b.brand_key ORDER BY b.id DESC) AS rn
                    FROM base b
                    WHERE b.name_key <> ''
                )
                SELECT l.medicine_id AS id,
                       l.name_value AS name,
                       ROUND(COALESCE(l.effective_cost_price, l.rate, l.mrp, 0), 2) as price
                FROM latest l
                JOIN target t ON lower(COALESCE(NULLIF(TRIM(l.medicine_category), ''), 'General')) = lower(t.category)
                WHERE l.rn = 1
                  AND (l.name_key != t.name_key OR l.brand_key != t.brand_key)
                ORDER BY l.id DESC
                LIMIT 6
                """,
                id
        );
    }

    private static int parsePackSize(String pack) {
        return InventoryQuantityUtils.parsePackSize(pack);
    }

    private static String formatPackSplitStock(int stockSmallest, String pack) {
        int safeStock = Math.max(0, stockSmallest);
        int packSize = Math.max(1, parsePackSize(pack));
        if (packSize <= 1) {
            return safeStock + ":0 strips";
        }
        int fullStrips = safeStock / packSize;
        int looseUnits = safeStock % packSize;
        return fullStrips + ":" + looseUnits + " strips";
    }
}
