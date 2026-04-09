package com.healthplus.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminSalesService {
    private final JdbcTemplate jdbcTemplate;

    public AdminSalesService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> listSales(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String like = "%" + normalized + "%";
        return jdbcTemplate.queryForList(
                """
                SELECT se.id,
                       se.invoice_no,
                       se.sale_date,
                       ROUND(COALESCE(se.grand_total, 0), 2) AS grand_total,
                       se.created_at,
                       se.updated_at,
                       p.id AS patient_id,
                       p.name AS patient_name,
                       d.id AS doctor_id,
                       d.name AS doctor_name,
                       COALESCE(SUM(si.quantity), 0) AS total_qty
                FROM sales_entries se
                LEFT JOIN patients p ON p.id = se.patient_id
                LEFT JOIN doctors d ON d.id = se.doctor_id
                LEFT JOIN sales_items si ON si.sale_id = se.id
                WHERE (? = ''
                  OR lower(COALESCE(se.invoice_no, '')) LIKE ?
                  OR lower(COALESCE(p.name, '')) LIKE ?
                  OR lower(COALESCE(d.name, '')) LIKE ?)
                GROUP BY se.id, se.invoice_no, se.sale_date, se.grand_total, se.created_at, se.updated_at, p.id, p.name, d.id, d.name
                ORDER BY se.id DESC
                LIMIT 200
                """,
                normalized,
                like,
                like,
                like
        );
    }

    public Map<String, Object> getSaleById(Long saleId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT se.id,
                       se.invoice_no,
                       se.sale_date,
                       se.notes,
                       ROUND(COALESCE(se.subtotal, 0), 2) AS subtotal,
                       ROUND(COALESCE(se.discount_total, 0), 2) AS discount_total,
                       ROUND(COALESCE(se.tax_total, 0), 2) AS tax_total,
                       ROUND(COALESCE(se.grand_total, 0), 2) AS grand_total,
                       se.created_at,
                       se.updated_at,
                       p.id AS patient_id,
                       p.name AS patient_name,
                       p.phone AS patient_phone,
                       p.age AS patient_age,
                       p.gender AS patient_gender,
                       p.address AS patient_address,
                       d.id AS doctor_id,
                       d.name AS doctor_name,
                       d.phone AS doctor_phone,
                       d.reg_no AS doctor_reg_no,
                       d.specialization AS doctor_specialization
                FROM sales_entries se
                LEFT JOIN patients p ON p.id = se.patient_id
                LEFT JOIN doctors d ON d.id = se.doctor_id
                WHERE se.id = ?
                LIMIT 1
                """,
                saleId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Sale entry not found");
        }

        List<Map<String, Object>> items = jdbcTemplate.queryForList(
                """
                SELECT si.id,
                       si.sale_id,
                       si.medicine_id,
                       si.inventory_detail_id,
                       si.medicine_name,
                       si.batch,
                       si.expiry,
                       si.quantity,
                       ROUND(si.unit_price, 2) AS unit_price,
                       ROUND(COALESCE(si.discount_percent, 0), 2) AS discount_percent,
                       ROUND(COALESCE(si.gst_percent, 0), 2) AS gst_percent,
                       ROUND(si.line_total, 2) AS line_total
                FROM sales_items si
                WHERE si.sale_id = ?
                ORDER BY si.id ASC
                """,
                saleId
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sale", rows.get(0));
        payload.put("items", items);
        return payload;
    }

    public List<Map<String, Object>> searchPatients(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String like = "%" + normalized + "%";
        return jdbcTemplate.queryForList(
                """
                SELECT id, name, phone, age, gender, address, created_at, updated_at
                FROM patients
                WHERE (? = ''
                  OR lower(COALESCE(name, '')) LIKE ?
                  OR lower(COALESCE(phone, '')) LIKE ?)
                ORDER BY id DESC
                LIMIT 100
                """,
                normalized,
                like,
                like
        );
    }

    public List<Map<String, Object>> searchDoctors(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String like = "%" + normalized + "%";
        return jdbcTemplate.queryForList(
                """
                SELECT id, name, phone, reg_no, specialization, created_at, updated_at
                FROM doctors
                WHERE (? = ''
                  OR lower(COALESCE(name, '')) LIKE ?
                  OR lower(COALESCE(phone, '')) LIKE ?
                  OR lower(COALESCE(reg_no, '')) LIKE ?
                  OR lower(COALESCE(specialization, '')) LIKE ?)
                ORDER BY id DESC
                LIMIT 100
                """,
                normalized,
                like,
                like,
                like,
                like
        );
    }

    @Transactional
    public Map<String, Object> createPatient(Map<String, Object> request) {
        String name = asString(request.get("name"));
        String phone = asString(request.get("phone"));
        int age = asInt(request.get("age"));
        String gender = asString(request.get("gender"));
        String address = asString(request.get("address"));
        if (name.isBlank()) {
            throw new IllegalArgumentException("Patient name is required");
        }

        List<Long> existing = jdbcTemplate.query(
                "SELECT id FROM patients WHERE lower(name) = lower(?) AND lower(COALESCE(phone, '')) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                name,
                phone
        );
        Long patientId;
        if (!existing.isEmpty()) {
            patientId = existing.get(0);
            jdbcTemplate.update(
                    """
                    UPDATE patients
                    SET age = CASE WHEN ? <= 0 THEN age ELSE ? END,
                        gender = CASE WHEN ? = '' THEN gender ELSE ? END,
                        address = CASE WHEN ? = '' THEN address ELSE ? END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    age,
                    age,
                    gender,
                    gender,
                    address,
                    address,
                    patientId
            );
        } else {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement(
                        "INSERT INTO patients (name, phone, age, gender, address, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                        Statement.RETURN_GENERATED_KEYS
                );
                ps.setString(1, name);
                ps.setString(2, phone);
                ps.setInt(3, Math.max(0, age));
                ps.setString(4, gender);
                ps.setString(5, address);
                return ps;
            }, keyHolder);
            if (keyHolder.getKey() == null) {
                throw new IllegalStateException("Unable to create patient");
            }
            patientId = keyHolder.getKey().longValue();
        }
        return jdbcTemplate.queryForMap(
                "SELECT id, name, phone, age, gender, address, created_at, updated_at FROM patients WHERE id = ? LIMIT 1",
                patientId
        );
    }

    @Transactional
    public Map<String, Object> createDoctor(Map<String, Object> request) {
        String name = asString(request.get("name"));
        String phone = asString(request.get("phone"));
        String regNo = asString(request.get("reg_no"));
        String specialization = asString(request.get("specialization"));
        if (name.isBlank()) {
            throw new IllegalArgumentException("Doctor name is required");
        }

        List<Long> existing = jdbcTemplate.query(
                "SELECT id FROM doctors WHERE lower(name) = lower(?) AND lower(COALESCE(phone, '')) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                name,
                phone
        );
        Long doctorId;
        if (!existing.isEmpty()) {
            doctorId = existing.get(0);
            jdbcTemplate.update(
                    """
                    UPDATE doctors
                    SET specialization = CASE WHEN ? = '' THEN specialization ELSE ? END,
                        reg_no = CASE WHEN ? = '' THEN reg_no ELSE ? END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    specialization,
                    specialization,
                    regNo,
                    regNo,
                    doctorId
            );
        } else {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement(
                        "INSERT INTO doctors (name, phone, reg_no, specialization, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
                        Statement.RETURN_GENERATED_KEYS
                );
                ps.setString(1, name);
                ps.setString(2, phone);
                ps.setString(3, regNo);
                ps.setString(4, specialization);
                return ps;
            }, keyHolder);
            if (keyHolder.getKey() == null) {
                throw new IllegalStateException("Unable to create doctor");
            }
            doctorId = keyHolder.getKey().longValue();
        }
        return jdbcTemplate.queryForMap(
                "SELECT id, name, phone, reg_no, specialization, created_at, updated_at FROM doctors WHERE id = ? LIMIT 1",
                doctorId
        );
    }

    public List<Map<String, Object>> searchMedicinesForSale(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String like = "%" + normalized + "%";
        List<Map<String, Object>> medicines = jdbcTemplate.queryForList(
                """
                SELECT m.id,
                       m.name,
                       m.brand,
                       ROUND(COALESCE(m.price, 0), 2) AS price,
                       COALESCE(m.stock, 0) AS stock,
                       COALESCE((
                         SELECT mid.pack
                         FROM medicine_inventory_details mid
                         WHERE mid.medicine_id = m.id
                         ORDER BY mid.id DESC
                         LIMIT 1
                       ), '') AS pack,
                       COALESCE((
                         SELECT mid.base_uom
                         FROM medicine_inventory_details mid
                         WHERE mid.medicine_id = m.id
                         ORDER BY mid.id DESC
                         LIMIT 1
                       ), '') AS base_uom,
                       COALESCE((
                         SELECT mid.pack_uom
                         FROM medicine_inventory_details mid
                         WHERE mid.medicine_id = m.id
                         ORDER BY mid.id DESC
                         LIMIT 1
                       ), '') AS pack_uom
                FROM medicines m
                WHERE COALESCE(m.stock, 0) > 0
                  AND (? = ''
                       OR lower(COALESCE(m.name, '')) LIKE ?
                       OR lower(COALESCE(m.brand, '')) LIKE ?)
                ORDER BY lower(m.name) ASC
                LIMIT 200
                """,
                normalized,
                like,
                like
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> medicine : medicines) {
            Long medicineId = ((Number) medicine.get("id")).longValue();
            int stockSmallest = ((Number) medicine.getOrDefault("stock", 0)).intValue();
            String pack = asString(medicine.get("pack"));
            int packSize = parsePackSize(pack);
            List<Map<String, Object>> lots = listMedicineLots(medicineId);
            String baseUom = normalizeUom(asString(medicine.get("base_uom")), InventoryQuantityUtils.baseUomFromPackSize(packSize));
            String packUom = normalizeUom(asString(medicine.get("pack_uom")), InventoryQuantityUtils.packUomFromPackSize(packSize));
            Map<String, Object> payload = new LinkedHashMap<>(medicine);
            payload.put("stock_smallest", stockSmallest);
            payload.put("stock_pack_size", packSize);
            payload.put("stock_base_uom", baseUom);
            payload.put("stock_pack_uom", packUom);
            payload.put("stock_display", formatPackSplitStock(stockSmallest, packSize, packUom, baseUom));
            payload.put("available_lots", lots.size());
            int totalLotAvailable = lots.stream()
                    .mapToInt(lot -> ((Number) lot.getOrDefault("available_qty", 0)).intValue())
                    .sum();
            payload.put("lot_available_qty", totalLotAvailable);
            if (!lots.isEmpty()) {
                Map<String, Object> nearest = lots.get(0);
                payload.put("stock_base_uom", normalizeUom(asString(nearest.get("base_uom")), baseUom));
                payload.put("stock_pack_uom", normalizeUom(asString(nearest.get("pack_uom")), packUom));
                payload.put("nearest_expiry", nearest.get("expiry"));
                payload.put("near_expiry", nearest.get("near_expiry"));
                payload.put("near_expiry_days", nearest.get("near_expiry_days"));
            } else {
                payload.put("nearest_expiry", "");
                payload.put("near_expiry", false);
                payload.put("near_expiry_days", null);
            }
            result.add(payload);
        }
        return result;
    }

    public List<Map<String, Object>> listMedicineLots(Long medicineId) {
        return listMedicineLots(medicineId, 1);
    }

    private List<Map<String, Object>> listMedicineLots(Long medicineId, int fallbackPackSize) {
        List<Map<String, Object>> lots = jdbcTemplate.queryForList(
                """
                SELECT mid.id,
                       mid.batch,
                       mid.expiry,
                       mid.pack,
                       COALESCE(mid.pack_size, 1) AS pack_size,
                       COALESCE(mid.base_uom, '') AS base_uom,
                       COALESCE(mid.pack_uom, '') AS pack_uom,
                       COALESCE(mid.purchase_uom, '') AS purchase_uom,
                       mid.qty_fr,
                       ROUND(COALESCE(mid.mrp, 0), 2) AS mrp,
                       ROUND(COALESCE(mid.rate, 0), 2) AS rate,
                       ROUND(COALESCE(mid.effective_cost_price, 0), 4) AS effective_cost_price,
                       COALESCE(mid.quantity_added, 0) AS quantity_added,
                       COALESCE(mid.bonus_qty, 0) AS bonus_qty,
                       COALESCE(mid.purchase_qty_entered, mid.quantity_added, 0) AS purchase_qty_entered,
                       COALESCE(mid.purchase_qty_base, 0) AS purchase_qty_base,
                       COALESCE(mid.bonus_qty_entered, mid.bonus_qty, 0) AS bonus_qty_entered,
                       COALESCE(mid.bonus_qty_base, 0) AS bonus_qty_base,
                       COALESCE(mid.sold_qty_base, COALESCE(mid.sold_qty, 0)) AS sold_qty_base
                FROM medicine_inventory_details mid
                WHERE mid.medicine_id = ?
                ORDER BY mid.id DESC
                """,
                medicineId
        );
        lots.sort(Comparator
                .comparing((Map<String, Object> lot) -> safeExpirySortDate(asString(lot.get("expiry"))))
                .thenComparing(lot -> ((Number) lot.get("id")).longValue()));

        List<Map<String, Object>> payload = new ArrayList<>();
        for (Map<String, Object> lot : lots) {
            LocalDate expiryDate = parseExpiryToDate(asString(lot.get("expiry")));
            int packSize = Math.max(1, asInt(lot.get("pack_size")));
            InventoryQuantityUtils.PackInfo parsedPack = InventoryQuantityUtils.parsePackInfo(asString(lot.get("pack")));
            if (packSize <= 1) {
                packSize = parsedPack.packSize();
            }
            if (packSize <= 1 && fallbackPackSize > 1) {
                packSize = fallbackPackSize;
            }
            String baseUom = normalizeUom(asString(lot.get("base_uom")), parsedPack.baseUom());
            if (baseUom.isBlank()) {
                baseUom = InventoryQuantityUtils.baseUomFromPackSize(packSize);
            }
            String packUom = normalizeUom(asString(lot.get("pack_uom")), parsedPack.packUom());
            if (packUom.isBlank()) {
                packUom = InventoryQuantityUtils.packUomFromPackSize(packSize);
            }
            String purchaseUom = normalizeUom(asString(lot.get("purchase_uom")), packUom);
            int purchaseQtyEntered = Math.max(0, asInt(lot.get("purchase_qty_entered")));
            int bonusQtyEntered = Math.max(0, asInt(lot.get("bonus_qty_entered")));
            int purchaseQtyBase = Math.max(0, asInt(lot.get("purchase_qty_base")));
            if (purchaseQtyBase <= 0) {
                purchaseQtyBase = InventoryQuantityUtils.toBaseUnits(purchaseQtyEntered, packSize);
            }
            int bonusQtyBase = Math.max(0, asInt(lot.get("bonus_qty_base")));
            if (bonusQtyBase <= 0) {
                bonusQtyBase = InventoryQuantityUtils.toBaseUnits(bonusQtyEntered, packSize);
            }
            int addedUnits = purchaseQtyBase + bonusQtyBase;
            int soldQtyUnits = Math.max(0, Math.min(addedUnits, asInt(lot.get("sold_qty_base"))));
            int availableQty = Math.max(0, addedUnits - soldQtyUnits);
            if (availableQty <= 0) {
                continue;
            }
            Integer nearExpiryDays = null;
            boolean nearExpiry = false;
            if (expiryDate != null) {
                nearExpiryDays = (int) ChronoUnit.DAYS.between(LocalDate.now(), expiryDate);
                nearExpiry = nearExpiryDays <= 90;
            }
            Map<String, Object> row = new LinkedHashMap<>(lot);
            row.put("pack_size", packSize);
            row.put("base_uom", baseUom);
            row.put("pack_uom", packUom);
            row.put("purchase_uom", purchaseUom);
            row.put("purchase_qty_base", purchaseQtyBase);
            row.put("bonus_qty_base", bonusQtyBase);
            row.put("sold_qty_base", soldQtyUnits);
            row.put("sold_qty_units", soldQtyUnits);
            row.put("available_qty", availableQty);
            row.put("available_qty_base", availableQty);
            row.put("available_display", formatPackSplitStock(availableQty, packSize, packUom, baseUom));
            row.put("near_expiry", nearExpiry);
            row.put("near_expiry_days", nearExpiryDays);
            payload.add(row);
        }
        return payload;
    }

    @Transactional
    public Map<String, Object> createSale(Map<String, Object> request, Long adminUserId) {
        return upsertSale(null, request, adminUserId);
    }

    @Transactional
    public Map<String, Object> updateSale(Long saleId, Map<String, Object> request, Long adminUserId) {
        return upsertSale(saleId, request, adminUserId);
    }

    private Map<String, Object> upsertSale(Long saleId, Map<String, Object> request, Long adminUserId) {
        if (saleId != null) {
            Integer exists = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM sales_entries WHERE id = ?",
                    Integer.class,
                    saleId
            );
            if (exists == null || exists == 0) {
                throw new IllegalArgumentException("Sale entry not found");
            }
            restoreSaleStock(saleId);
        }

        String invoiceNo = asString(request.get("invoice_no"));
        if (saleId == null) {
            invoiceNo = generateNextInvoiceNo();
        } else if (invoiceNo.isBlank()) {
            String existingInvoice = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(invoice_no, '') FROM sales_entries WHERE id = ? LIMIT 1",
                    String.class,
                    saleId
            );
            invoiceNo = asString(existingInvoice);
        }
        String saleDate = asString(request.get("sale_date"));
        if (saleDate.isBlank()) {
            saleDate = LocalDate.now().toString();
        }
        String notes = asString(request.get("notes"));
        Long patientId = resolvePatientId(request.get("patient_id"), castMap(request.get("patient")));
        Long doctorId = resolveDoctorId(request.get("doctor_id"), castMap(request.get("doctor")));

        List<Map<String, Object>> itemsPayload = castListOfMaps(request.get("items"));
        if (itemsPayload.isEmpty()) {
            throw new IllegalArgumentException("At least one sale item is required");
        }

        Long resolvedSaleId = saleId;
        if (resolvedSaleId == null) {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            String finalInvoiceNo = invoiceNo;
            String finalSaleDate = saleDate;
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement(
                        """
                        INSERT INTO sales_entries
                        (invoice_no, sale_date, patient_id, doctor_id, notes, subtotal, discount_total, tax_total, grand_total, created_by_user_id, updated_by_user_id, updated_at)
                        VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        Statement.RETURN_GENERATED_KEYS
                );
                ps.setString(1, finalInvoiceNo);
                ps.setString(2, finalSaleDate);
                if (patientId == null) {
                    ps.setObject(3, null);
                } else {
                    ps.setLong(3, patientId);
                }
                if (doctorId == null) {
                    ps.setObject(4, null);
                } else {
                    ps.setLong(4, doctorId);
                }
                ps.setString(5, notes);
                if (adminUserId == null) {
                    ps.setObject(6, null);
                    ps.setObject(7, null);
                } else {
                    ps.setLong(6, adminUserId);
                    ps.setLong(7, adminUserId);
                }
                return ps;
            }, keyHolder);
            if (keyHolder.getKey() == null) {
                throw new IllegalStateException("Failed to create sale entry");
            }
            resolvedSaleId = keyHolder.getKey().longValue();
        } else {
            Long finalResolvedSaleId = resolvedSaleId;
            jdbcTemplate.update(
                    """
                    UPDATE sales_entries
                    SET invoice_no = ?,
                        sale_date = ?,
                        patient_id = ?,
                        doctor_id = ?,
                        notes = ?,
                        updated_by_user_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    invoiceNo,
                    saleDate,
                    patientId,
                    doctorId,
                    notes,
                    adminUserId,
                    finalResolvedSaleId
            );
            jdbcTemplate.update("DELETE FROM sales_items WHERE sale_id = ?", finalResolvedSaleId);
        }

        double subtotal = 0;
        double discountTotal = 0;
        double taxTotal = 0;
        for (Map<String, Object> item : itemsPayload) {
            Long medicineId = asLong(item.get("medicine_id"));
            if (medicineId == null || medicineId <= 0) {
                throw new IllegalArgumentException("Invalid medicine_id in sale item");
            }
            String preferredBatch = asString(item.get("batch"));
            int quantity = resolveRequestedQuantity(item, medicineId);
            if (quantity <= 0) {
                throw new IllegalArgumentException("Sale quantity should be greater than 0");
            }
            double unitPrice = round2(asDouble(item.get("unit_price")));
            double discountPercent = round2(asDouble(item.get("discount_percent")));
            double gstPercent = round2(asDouble(item.get("gst_percent")));

            Map<String, Object> medicine = jdbcTemplate.queryForMap(
                    "SELECT id, name, COALESCE(price, 0) AS price, COALESCE(stock, 0) AS stock FROM medicines WHERE id = ? LIMIT 1",
                    medicineId
            );
            if (unitPrice <= 0) {
                unitPrice = round2(asDouble(medicine.get("price")));
            }
            if (unitPrice <= 0) {
                throw new IllegalArgumentException("Unit price missing for medicine: " + medicine.get("name"));
            }

            int requestedPackSize = Math.max(1, asInt(item.get("pack_size")));
            if (requestedPackSize <= 1) {
                requestedPackSize = resolvePackSizeForSale(medicineId);
            }
            List<LotAllocation> allocations = allocateLotsAndConsumeStock(medicineId, quantity, requestedPackSize, preferredBatch);
            String medicineName = asString(medicine.get("name"));
            double baseAmount = round2(unitPrice * quantity);
            double discountAmount = round2(baseAmount * (Math.max(0, discountPercent) / 100.0));
            double taxableAmount = round2(baseAmount - discountAmount);
            double taxAmount = round2(taxableAmount * (Math.max(0, gstPercent) / 100.0));
            double lineTotal = round2(taxableAmount + taxAmount);

            subtotal = round2(subtotal + baseAmount);
            discountTotal = round2(discountTotal + discountAmount);
            taxTotal = round2(taxTotal + taxAmount);

            for (LotAllocation allocation : allocations) {
                double allocationTotal = quantity == 0 ? 0 : round2(lineTotal * (allocation.quantity / (double) quantity));
                jdbcTemplate.update(
                        """
                        INSERT INTO sales_items
                        (sale_id, medicine_id, inventory_detail_id, medicine_name, batch, expiry, quantity, unit_price, discount_percent, gst_percent, line_total)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        resolvedSaleId,
                        medicineId,
                        allocation.inventoryDetailId,
                        medicineName,
                        allocation.batch,
                        allocation.expiry,
                        allocation.quantity,
                        unitPrice,
                        Math.max(0, discountPercent),
                        Math.max(0, gstPercent),
                        allocationTotal
                );
            }
        }

        double grandTotal = round2(subtotal - discountTotal + taxTotal);
        jdbcTemplate.update(
                """
                UPDATE sales_entries
                SET subtotal = ?, discount_total = ?, tax_total = ?, grand_total = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                subtotal,
                discountTotal,
                taxTotal,
                grandTotal,
                adminUserId,
                resolvedSaleId
        );
        return getSaleById(resolvedSaleId);
    }

    private int resolveRequestedQuantity(Map<String, Object> item, Long medicineId) {
        boolean hasSplitFields =
                item.containsKey("strips")
                        || item.containsKey("tablets")
                        || item.containsKey("units");
        if (!hasSplitFields) {
            return asInt(item.get("quantity"));
        }

        int strips = Math.max(0, asInt(item.get("strips")));
        int tablets = Math.max(0, asInt(item.get("tablets")));
        if (tablets <= 0) {
            tablets = Math.max(0, asInt(item.get("units")));
        }

        int packSize = Math.max(1, asInt(item.get("pack_size")));
        if (packSize <= 1) {
            packSize = resolvePackSizeForSale(medicineId);
        }
        return (Math.max(0, strips) * Math.max(1, packSize)) + Math.max(0, tablets);
    }

    private int resolvePackSizeForSale(Long medicineId) {
        List<Map<String, Object>> packs = jdbcTemplate.queryForList(
                """
                SELECT COALESCE(mid.pack_size, 0) AS pack_size,
                       COALESCE(mid.pack, '') AS pack
                FROM medicine_inventory_details mid
                WHERE mid.medicine_id = ?
                ORDER BY mid.id DESC
                LIMIT 1
                """,
                medicineId
        );
        if (packs.isEmpty()) {
            return 1;
        }
        Map<String, Object> row = packs.get(0);
        int packSize = asInt(row.get("pack_size"));
        if (packSize > 0) {
            return packSize;
        }
        return parsePackSize(asString(row.get("pack")));
    }

    private String generateNextInvoiceNo() {
        Integer maxNumber = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(CAST(SUBSTR(invoice_no, 2) AS INTEGER)), 0)
                FROM sales_entries
                WHERE invoice_no GLOB 'A[0-9][0-9][0-9][0-9][0-9][0-9]'
                """,
                Integer.class
        );
        int next = Math.max(0, maxNumber == null ? 0 : maxNumber) + 1;
        return String.format(Locale.ROOT, "A%06d", next);
    }

    private List<LotAllocation> allocateLotsAndConsumeStock(Long medicineId, int quantityRequired, int fallbackPackSize, String preferredBatch) {
        List<Map<String, Object>> lots = listMedicineLots(medicineId, fallbackPackSize);
        List<Map<String, Object>> prioritizedLots = new ArrayList<>(lots);
        String normalizedPreferredBatch = preferredBatch == null ? "" : preferredBatch.trim().toLowerCase(Locale.ROOT);
        if (!normalizedPreferredBatch.isBlank()) {
            List<Map<String, Object>> matchingLots = new ArrayList<>();
            List<Map<String, Object>> otherLots = new ArrayList<>();
            for (Map<String, Object> lot : lots) {
                String lotBatch = asString(lot.get("batch")).toLowerCase(Locale.ROOT);
                if (normalizedPreferredBatch.equals(lotBatch)) {
                    matchingLots.add(lot);
                } else {
                    otherLots.add(lot);
                }
            }
            if (matchingLots.isEmpty()) {
                throw new IllegalArgumentException("Selected batch \"" + preferredBatch + "\" is not available for medicine id " + medicineId);
            }
            prioritizedLots.clear();
            prioritizedLots.addAll(matchingLots);
            prioritizedLots.addAll(otherLots);
        }

        int available = prioritizedLots.stream().mapToInt(row -> asInt(row.get("available_qty"))).sum();
        if (available < quantityRequired) {
            throw new IllegalArgumentException("Not enough stock for medicine id " + medicineId + ". Available: " + available);
        }

        List<LotAllocation> allocations = new ArrayList<>();
        int remaining = quantityRequired;
        for (Map<String, Object> lot : prioritizedLots) {
            if (remaining <= 0) {
                break;
            }
            int lotAvailable = asInt(lot.get("available_qty"));
            if (lotAvailable <= 0) {
                continue;
            }
            int take = Math.min(remaining, lotAvailable);
            if (take <= 0) {
                continue;
            }
            Long inventoryDetailId = ((Number) lot.get("id")).longValue();
            allocations.add(new LotAllocation(
                    inventoryDetailId,
                    asString(lot.get("batch")),
                    asString(lot.get("expiry")),
                    take
            ));
            int existingSoldUnits = Math.max(0, asInt(lot.get("sold_qty_units")));
            int nextSoldBase = existingSoldUnits + take;
            jdbcTemplate.update(
                    "UPDATE medicine_inventory_details SET sold_qty_base = ?, sold_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    nextSoldBase,
                    nextSoldBase,
                    inventoryDetailId
            );
            remaining -= take;
        }
        if (remaining > 0) {
            throw new IllegalArgumentException("Unable to allocate stock lots for medicine id " + medicineId);
        }

        int remainingStock = Math.max(0, available - quantityRequired);
        jdbcTemplate.update(
                "UPDATE medicines SET stock = ? WHERE id = ?",
                remainingStock,
                medicineId
        );
        return allocations;
    }

    private void restoreSaleStock(Long saleId) {
        List<Map<String, Object>> items = jdbcTemplate.queryForList(
                "SELECT medicine_id, inventory_detail_id, quantity FROM sales_items WHERE sale_id = ?",
                saleId
        );
        if (items.isEmpty()) {
            return;
        }

        Map<Long, Integer> medicineQty = new LinkedHashMap<>();
        for (Map<String, Object> item : items) {
            Long medicineId = asLong(item.get("medicine_id"));
            Long inventoryDetailId = asLong(item.get("inventory_detail_id"));
            int quantity = asInt(item.get("quantity"));
            if (medicineId != null && quantity > 0) {
                medicineQty.put(medicineId, medicineQty.getOrDefault(medicineId, 0) + quantity);
            }
            if (inventoryDetailId != null && quantity > 0) {
                jdbcTemplate.update(
                        """
                        UPDATE medicine_inventory_details
                        SET sold_qty_base = CASE WHEN COALESCE(sold_qty_base, 0) - ? < 0 THEN 0 ELSE COALESCE(sold_qty_base, 0) - ? END,
                            sold_qty = CASE WHEN COALESCE(sold_qty, 0) - ? < 0 THEN 0 ELSE COALESCE(sold_qty, 0) - ? END,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                        quantity,
                        quantity,
                        quantity,
                        quantity,
                        inventoryDetailId
                );
            }
        }

        for (Map.Entry<Long, Integer> entry : medicineQty.entrySet()) {
            jdbcTemplate.update(
                    "UPDATE medicines SET stock = stock + ? WHERE id = ?",
                    entry.getValue(),
                    entry.getKey()
            );
        }
    }

    private Long resolvePatientId(Object patientIdRaw, Map<String, Object> patientPayload) {
        Long patientId = asLong(patientIdRaw);
        if (patientId != null && patientId > 0) {
            return patientId;
        }
        if (patientPayload.isEmpty()) {
            return null;
        }
        String name = asString(patientPayload.get("name"));
        if (name.isBlank()) {
            return null;
        }
        Map<String, Object> created = createPatient(patientPayload);
        return ((Number) created.get("id")).longValue();
    }

    private Long resolveDoctorId(Object doctorIdRaw, Map<String, Object> doctorPayload) {
        Long doctorId = asLong(doctorIdRaw);
        if (doctorId != null && doctorId > 0) {
            return doctorId;
        }
        if (doctorPayload.isEmpty()) {
            return null;
        }
        String name = asString(doctorPayload.get("name"));
        if (name.isBlank()) {
            return null;
        }
        Map<String, Object> created = createDoctor(doctorPayload);
        return ((Number) created.get("id")).longValue();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object value) {
        if (!(value instanceof Map<?, ?> mapValue)) {
            return Map.of();
        }
        Map<String, Object> parsed = new LinkedHashMap<>();
        mapValue.forEach((k, v) -> parsed.put(String.valueOf(k), v));
        return parsed;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castListOfMaps(Object value) {
        if (!(value instanceof List<?> listValue)) {
            return List.of();
        }
        List<Map<String, Object>> parsed = new ArrayList<>();
        for (Object item : listValue) {
            parsed.add(castMap(item));
        }
        return parsed;
    }

    private static String asString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static int asInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(asString(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            String text = asString(value);
            if (text.isBlank()) {
                return null;
            }
            return Long.parseLong(text);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static double asDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(asString(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static LocalDate safeExpirySortDate(String expiry) {
        LocalDate parsed = parseExpiryToDate(expiry);
        return parsed == null ? LocalDate.of(9999, 12, 31) : parsed;
    }

    private static LocalDate parseExpiryToDate(String expiry) {
        String value = expiry == null ? "" : expiry.trim();
        if (value.isBlank()) {
            return null;
        }
        try {
            if (value.matches("\\d{2}/\\d{2}")) {
                int month = Integer.parseInt(value.substring(0, 2));
                int year = 2000 + Integer.parseInt(value.substring(3, 5));
                return YearMonth.of(year, month).atEndOfMonth();
            }
            if (value.matches("\\d{2}/\\d{4}")) {
                int month = Integer.parseInt(value.substring(0, 2));
                int year = Integer.parseInt(value.substring(3, 7));
                return YearMonth.of(year, month).atEndOfMonth();
            }
            if (value.matches("\\d{4}-\\d{2}-\\d{2}")) {
                return LocalDate.parse(value);
            }
            if (value.matches("\\d{2}-\\d{2}-\\d{4}")) {
                int day = Integer.parseInt(value.substring(0, 2));
                int month = Integer.parseInt(value.substring(3, 5));
                int year = Integer.parseInt(value.substring(6, 10));
                return LocalDate.of(year, month, day);
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static int parsePackSize(String pack) {
        return InventoryQuantityUtils.parsePackSize(pack);
    }

    private static String formatPackSplitStock(int stockSmallest, int packSize, String packUom, String baseUom) {
        int safeStock = Math.max(0, stockSmallest);
        int safePackSize = Math.max(1, packSize);
        String packLabel = normalizeUom(packUom, InventoryQuantityUtils.packUomFromPackSize(safePackSize));
        String baseLabel = normalizeUom(baseUom, InventoryQuantityUtils.baseUomFromPackSize(safePackSize));
        if (safePackSize <= 1) {
            return safeStock + " " + baseLabel;
        }
        int fullStrips = safeStock / safePackSize;
        int looseUnits = safeStock % safePackSize;
        if (looseUnits == 0) {
            return fullStrips + " " + packLabel;
        }
        return fullStrips + " " + packLabel + " + " + looseUnits + " " + baseLabel;
    }

    private static String normalizeUom(String value, String fallback) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return fallback == null ? "" : fallback.trim().toUpperCase(Locale.ROOT);
        }
        return normalized;
    }

    private record LotAllocation(Long inventoryDetailId, String batch, String expiry, int quantity) {}
}
