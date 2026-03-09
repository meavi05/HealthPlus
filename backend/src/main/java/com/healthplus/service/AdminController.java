package com.healthplus.service;

import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final JdbcTemplate jdbcTemplate;
    private final LocalUserService localUserService;

    public AdminController(JdbcTemplate jdbcTemplate, LocalUserService localUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.localUserService = localUserService;
    }

    @GetMapping("/users")
    public List<Map<String, Object>> getUsers() {
        return jdbcTemplate.queryForList(
                "SELECT id, email, name, role, created_at FROM users ORDER BY id DESC"
        );
    }

    @GetMapping("/orders")
    public List<Map<String, Object>> getOrders() {
        return jdbcTemplate.queryForList(
                """
                SELECT o.id, o.user_id, u.email as user_email, ROUND(o.total_price, 2) as total_price, o.status, o.payment_status, o.payment_method, o.created_at
                FROM orders o
                LEFT JOIN users u ON u.id = o.user_id
                ORDER BY o.id DESC
                """
        );
    }

    @GetMapping("/medicines")
    public List<Map<String, Object>> getMedicines() {
        return jdbcTemplate.queryForList(
                """
                SELECT m.id, m.name, m.description, ROUND(m.price, 2) as price, m.stock, m.brand, m.category,
                       ROUND(COALESCE((
                         SELECT midx.mrp
                         FROM medicine_inventory_details midx
                         WHERE midx.medicine_id = m.id
                         ORDER BY midx.id DESC
                         LIMIT 1
                       ), m.mrp, m.price), 2) as mrp, m.discount_percent, m.requires_prescription, m.rating, m.image_url, m.delivery_eta,
                       m.admin_updated_at,
                       u.name as admin_updated_by_name,
                       u.email as admin_updated_by_email
                FROM medicines m
                LEFT JOIN users u ON u.id = m.admin_updated_by_user_id
                ORDER BY m.id DESC
                """
        );
    }

    @GetMapping("/item-master/medicines")
    public List<Map<String, Object>> getItemMasterMedicines(@RequestParam(name = "q", defaultValue = "") String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase();
        String like = "%" + normalized + "%";

        return jdbcTemplate.queryForList(
                """
                SELECT m.id,
                       m.name,
                       m.brand,
                       m.category,
                       ROUND(m.price, 2) as price,
                       m.stock,
                       ROUND(COALESCE((
                         SELECT midx.mrp
                         FROM medicine_inventory_details midx
                         WHERE midx.medicine_id = m.id
                         ORDER BY midx.id DESC
                         LIMIT 1
                       ), m.mrp, m.price), 2) as mrp,
                       m.admin_updated_at,
                       updater.name as admin_updated_by_name,
                       updater.email as admin_updated_by_email,
                       COUNT(mid.id) as mapped_rows,
                       MAX(mid.created_at) as last_mapped_at
                FROM medicines m
                LEFT JOIN users updater ON updater.id = m.admin_updated_by_user_id
                JOIN medicine_inventory_details mid ON mid.medicine_id = m.id
                WHERE (? = ''
                  OR lower(m.name) LIKE ?
                  OR lower(COALESCE(m.brand, '')) LIKE ?
                  OR lower(COALESCE(m.category, '')) LIKE ?
                  OR EXISTS (
                    SELECT 1
                    FROM medicine_inventory_details midx
                    WHERE midx.medicine_id = m.id
                      AND (lower(COALESCE(midx.hsn, '')) LIKE ?
                        OR lower(COALESCE(midx.batch, '')) LIKE ?
                        OR lower(COALESCE(midx.manufacturer, '')) LIKE ?)
                  ))
                GROUP BY m.id, m.name, m.brand, m.category, m.price, m.stock, m.mrp, m.admin_updated_at, updater.name, updater.email
                ORDER BY MAX(mid.id) DESC
                """,
                normalized,
                like,
                like,
                like,
                like,
                like,
                like
        );
    }

    @GetMapping("/medicines/{medicineId}")
    public ResponseEntity<?> getMedicineDetails(@PathVariable Long medicineId) {
        List<Map<String, Object>> medicines = jdbcTemplate.queryForList(
                """
                SELECT m.id, m.name, m.description, ROUND(m.price, 2) as price, m.stock, m.brand, m.category,
                       ROUND(COALESCE((
                         SELECT midx.mrp
                         FROM medicine_inventory_details midx
                         WHERE midx.medicine_id = m.id
                         ORDER BY midx.id DESC
                         LIMIT 1
                       ), m.mrp, m.price), 2) as mrp, m.discount_percent, m.requires_prescription, m.rating, m.image_url, m.delivery_eta,
                       m.admin_updated_at, u.name as admin_updated_by_name, u.email as admin_updated_by_email
                FROM medicines m
                LEFT JOIN users u ON u.id = m.admin_updated_by_user_id
                WHERE m.id = ?
                """,
                medicineId
        );
        if (medicines.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Medicine not found"));
        }

        List<Map<String, Object>> inventoryDetails = jdbcTemplate.queryForList(
                """
                SELECT mid.id, mid.hsn, mid.manufacturer, mid.pack, mid.qty_fr, mid.batch, mid.expiry,
                       ROUND(mid.mrp, 2) as mrp, ROUND(mid.rate, 2) as rate, ROUND(mid.dis1, 2) as dis1, ROUND(mid.dis2, 2) as dis2, ROUND(mid.amount, 2) as amount,
                       mid.quantity_added, mid.bonus, mid.source, mid.medicine_category, mid.medicine_type, mid.medicine_description, mid.medicine_uses, mid.medicine_doses,
                       mid.created_at, mid.admin_updated_at,
                       u.name as admin_updated_by_name, u.email as admin_updated_by_email
                FROM medicine_inventory_details mid
                LEFT JOIN users u ON u.id = mid.admin_updated_by_user_id
                WHERE medicine_id = ?
                ORDER BY mid.id DESC
                LIMIT 25
                """,
                medicineId
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("medicine", medicines.get(0));
        payload.put("inventory_details", inventoryDetails);
        return ResponseEntity.ok(payload);
    }

    @PutMapping("/medicines/{medicineId}")
    public ResponseEntity<?> updateMedicine(
            @PathVariable Long medicineId,
            @RequestBody Map<String, Object> request,
            Authentication authentication
    ) {
        LocalUser admin = localUserService.resolveOrCreate(authentication);

        List<Map<String, Object>> medicines = jdbcTemplate.queryForList(
                "SELECT id, name, description, price, stock, brand, category, mrp, discount_percent, requires_prescription, delivery_eta FROM medicines WHERE id = ? LIMIT 1",
                medicineId
        );
        if (medicines.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Medicine not found"));
        }

        Map<String, Object> current = medicines.get(0);
        String name = valueOrCurrentString(request, "name", current.get("name"));
        String description = valueOrCurrentString(request, "description", current.get("description"));
        String brand = valueOrCurrentString(request, "brand", current.get("brand"));
        String category = valueOrCurrentString(request, "category", current.get("category"));
        String deliveryEta = valueOrCurrentString(request, "delivery_eta", current.get("delivery_eta"));
        double price = round2(valueOrCurrentDouble(request, "price", current.get("price")));
        double mrp = round2(valueOrCurrentDouble(request, "mrp", current.get("mrp")));
        int stock = valueOrCurrentInt(request, "stock", current.get("stock"));
        int discountPercent = valueOrCurrentInt(request, "discount_percent", current.get("discount_percent"));
        int requiresPrescription = valueOrCurrentBooleanInt(request, "requires_prescription", current.get("requires_prescription"));

        if (name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Medicine name is required"));
        }
        if (price < 0 || mrp < 0 || stock < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Price, MRP, and stock must be non-negative"));
        }

        jdbcTemplate.update(
                """
                UPDATE medicines
                SET name = ?, description = ?, price = ?, stock = ?, brand = ?, category = ?, mrp = ?, discount_percent = ?, requires_prescription = ?, delivery_eta = ?,
                    admin_updated_by_user_id = ?, admin_updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                name,
                description,
                price,
                stock,
                brand,
                category,
                mrp,
                discountPercent,
                requiresPrescription,
                deliveryEta,
                admin.id(),
                medicineId
        );

        return ResponseEntity.ok(Map.of(
                "message", "Medicine updated successfully",
                "medicine_id", medicineId,
                "updated_by", admin.email()
        ));
    }

    @PutMapping("/inventory-details/{detailId}")
    public ResponseEntity<?> updateInventoryDetail(
            @PathVariable Long detailId,
            @RequestBody Map<String, Object> request,
            Authentication authentication
    ) {
        LocalUser admin = localUserService.resolveOrCreate(authentication);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, hsn, manufacturer, pack, qty_fr, batch, expiry, mrp, rate, dis1, dis2, amount, quantity_added, bonus, source, medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses FROM medicine_inventory_details WHERE id = ? LIMIT 1",
                detailId
        );
        if (rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Inventory detail not found"));
        }

        Map<String, Object> current = rows.get(0);
        String hsn = valueOrCurrentString(request, "hsn", current.get("hsn"));
        String manufacturer = valueOrCurrentString(request, "manufacturer", current.get("manufacturer"));
        String pack = valueOrCurrentString(request, "pack", current.get("pack"));
        String qtyFr = valueOrCurrentString(request, "qty_fr", current.get("qty_fr"));
        String batch = valueOrCurrentString(request, "batch", current.get("batch"));
        String expiry = valueOrCurrentString(request, "expiry", current.get("expiry"));
        double mrp = round2(valueOrCurrentDouble(request, "mrp", current.get("mrp")));
        double rate = round2(valueOrCurrentDouble(request, "rate", current.get("rate")));
        double dis1 = round2(valueOrCurrentDouble(request, "dis1", current.get("dis1")));
        double dis2 = round2(valueOrCurrentDouble(request, "dis2", current.get("dis2")));
        double amount = round2(valueOrCurrentDouble(request, "amount", current.get("amount")));
        int quantityAdded = valueOrCurrentInt(request, "quantity_added", current.get("quantity_added"));
        int bonus = valueOrCurrentInt(request, "bonus", current.get("bonus"));
        String source = valueOrCurrentString(request, "source", current.get("source"));
        String medicineCategory = valueOrCurrentString(request, "medicine_category", current.get("medicine_category"));
        String medicineType = valueOrCurrentString(request, "medicine_type", current.get("medicine_type"));
        String medicineDescription = valueOrCurrentString(request, "medicine_description", current.get("medicine_description"));
        String medicineUses = valueOrCurrentString(request, "medicine_uses", current.get("medicine_uses"));
        String medicineDoses = valueOrCurrentString(request, "medicine_doses", current.get("medicine_doses"));

        if (mrp < 0 || rate < 0 || dis1 < 0 || dis2 < 0 || amount < 0 || quantityAdded < 0 || bonus < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Numeric fields must be non-negative"));
        }

        jdbcTemplate.update(
                """
                UPDATE medicine_inventory_details
                SET hsn = ?, manufacturer = ?, pack = ?, qty_fr = ?, batch = ?, expiry = ?,
                    mrp = ?, rate = ?, dis1 = ?, dis2 = ?, amount = ?, quantity_added = ?, bonus = ?, source = ?,
                    medicine_category = ?, medicine_type = ?, medicine_description = ?, medicine_uses = ?, medicine_doses = ?,
                    admin_updated_by_user_id = ?, admin_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                hsn,
                manufacturer,
                pack,
                qtyFr,
                batch,
                expiry,
                mrp,
                rate,
                dis1,
                dis2,
                amount,
                quantityAdded,
                bonus,
                source,
                medicineCategory,
                medicineType,
                medicineDescription,
                medicineUses,
                medicineDoses,
                admin.id(),
                detailId
        );

        return ResponseEntity.ok(Map.of(
                "message", "Inventory detail updated successfully",
                "detail_id", detailId,
                "updated_by", admin.email()
        ));
    }

    @PostMapping("/inventory/manual-entry")
    public ResponseEntity<?> addManualInventoryEntry(
            @RequestBody Map<String, Object> request,
            Authentication authentication
    ) {
        try {
            LocalUser admin = localUserService.resolveOrCreate(authentication);

        long medicineId = valueOrCurrentInt(request, "medicine_id", 0);
        String medicineName = valueOrCurrentString(request, "medicine_name", "");
        String brand = valueOrCurrentString(request, "brand", "");
        String description = valueOrCurrentString(request, "description", "");
        String category = valueOrCurrentString(request, "category", "");
        double rate = round2(valueOrCurrentDouble(request, "rate", 0));
        double mrp = round2(valueOrCurrentDouble(request, "mrp", rate));
        int quantityAdded = valueOrCurrentInt(request, "quantity_added", 0);
        int bonus = valueOrCurrentInt(request, "bonus", 0);
        String hsn = valueOrCurrentString(request, "hsn", "");
        String manufacturer = valueOrCurrentString(request, "manufacturer", brand);
        String pack = valueOrCurrentString(request, "pack", "");
        String qtyFr = valueOrCurrentString(request, "qty_fr", "");
        String batch = valueOrCurrentString(request, "batch", "");
        String expiry = valueOrCurrentString(request, "expiry", "");
        double dis1 = round2(valueOrCurrentDouble(request, "dis1", 0));
        double dis2 = round2(valueOrCurrentDouble(request, "dis2", 0));
        double amount = round2(valueOrCurrentDouble(request, "amount", 0));
        String source = valueOrCurrentString(request, "source", "manual");
        String medicineCategory = valueOrCurrentString(request, "medicine_category", category);
        String medicineType = valueOrCurrentString(request, "medicine_type", "");
        String medicineDescription = valueOrCurrentString(request, "medicine_description", description);
        String medicineUses = valueOrCurrentString(request, "medicine_uses", "");
        String medicineDoses = valueOrCurrentString(request, "medicine_doses", "");

        if (quantityAdded <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Quantity added should be greater than 0"));
        }
        if (rate < 0 || mrp < 0 || bonus < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Rate, MRP and bonus should be non-negative"));
        }

        if (medicineId <= 0) {
            if (medicineName.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Medicine name is required for new/manual medicine"));
            }
            medicineId = resolveOrCreateMedicine(medicineName, brand, description, category, rate, mrp, quantityAdded + bonus);
        } else {
            int updated = jdbcTemplate.update(
                    "UPDATE medicines SET stock = stock + ?, price = ?, mrp = CASE WHEN mrp IS NULL OR mrp < ? THEN ? ELSE mrp END WHERE id = ?",
                    quantityAdded + bonus,
                    rate,
                    mrp,
                    mrp,
                    medicineId
            );
            if (updated == 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "Selected medicine does not exist"));
            }
        }

        String linkageType = valueOrCurrentString(request, "linkage_type", "none").toLowerCase();
        Long agencyBillId = resolveAgencyBillForManualEntry(linkageType, request);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        long finalMedicineId = medicineId;
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    """
                    INSERT INTO medicine_inventory_details
                    (medicine_id, agency_bill_id, hsn, manufacturer, pack, qty_fr, batch, expiry, mrp, rate, dis1, dis2, amount, quantity_added, bonus, source,
                     medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses,
                     admin_updated_by_user_id, admin_updated_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, finalMedicineId);
            if (agencyBillId == null) {
                ps.setObject(2, null);
            } else {
                ps.setLong(2, agencyBillId);
            }
            ps.setString(3, hsn);
            ps.setString(4, manufacturer);
            ps.setString(5, pack);
            ps.setString(6, qtyFr);
            ps.setString(7, batch);
            ps.setString(8, expiry);
            ps.setDouble(9, mrp);
            ps.setDouble(10, rate);
            ps.setDouble(11, dis1);
            ps.setDouble(12, dis2);
            ps.setDouble(13, amount);
            ps.setInt(14, quantityAdded + bonus);
            ps.setInt(15, bonus);
            ps.setString(16, source.isBlank() ? "manual" : source);
            ps.setString(17, medicineCategory);
            ps.setString(18, medicineType);
            ps.setString(19, medicineDescription);
            ps.setString(20, medicineUses);
            ps.setString(21, medicineDoses);
            ps.setLong(22, admin.id());
            return ps;
        }, keyHolder);

        if (keyHolder.getKey() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unable to create inventory detail entry"));
        }

            return ResponseEntity.ok(Map.of(
                    "message", "Inventory entry added successfully",
                    "medicine_id", medicineId,
                    "inventory_detail_id", keyHolder.getKey().longValue(),
                    "agency_bill_id", agencyBillId
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/inventory-details/{detailId}")
    public ResponseEntity<?> deleteInventoryDetail(@PathVariable Long detailId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, medicine_id, quantity_added FROM medicine_inventory_details WHERE id = ? LIMIT 1",
                detailId
        );
        if (rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Inventory detail not found"));
        }

        Map<String, Object> detail = rows.get(0);
        long medicineId = ((Number) detail.get("medicine_id")).longValue();
        int quantityAdded = ((Number) detail.getOrDefault("quantity_added", 0)).intValue();

        jdbcTemplate.update("DELETE FROM medicine_inventory_details WHERE id = ?", detailId);
        jdbcTemplate.update(
                "UPDATE medicines SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END WHERE id = ?",
                quantityAdded,
                quantityAdded,
                medicineId
        );

        List<Double> latestRates = jdbcTemplate.query(
                "SELECT rate FROM medicine_inventory_details WHERE medicine_id = ? ORDER BY id DESC LIMIT 1",
                (rs, rowNum) -> rs.getDouble("rate"),
                medicineId
        );
        if (!latestRates.isEmpty()) {
            double latest = round2(latestRates.get(0));
            jdbcTemplate.update("UPDATE medicines SET price = ?, mrp = CASE WHEN mrp IS NULL OR mrp < ? THEN ? ELSE mrp END WHERE id = ?",
                    latest,
                    latest,
                    latest,
                    medicineId
            );
        }

        return ResponseEntity.ok(Map.of(
                "message", "Inventory detail deleted",
                "medicine_id", medicineId
        ));
    }

    @DeleteMapping("/medicines/{medicineId}")
    public ResponseEntity<?> deleteMedicine(@PathVariable Long medicineId) {
        Integer orderUsage = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM order_items WHERE medicine_id = ?",
                Integer.class,
                medicineId
        );
        if (orderUsage != null && orderUsage > 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Medicine is present in order history and cannot be deleted. Set stock to 0 instead."
            ));
        }

        int deletedInventoryRows = jdbcTemplate.update(
                "DELETE FROM medicine_inventory_details WHERE medicine_id = ?",
                medicineId
        );
        int deletedMedicines = jdbcTemplate.update(
                "DELETE FROM medicines WHERE id = ?",
                medicineId
        );
        if (deletedMedicines == 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Medicine not found"));
        }

        return ResponseEntity.ok(Map.of(
                "message", "Medicine deleted successfully",
                "deleted_inventory_rows", deletedInventoryRows
        ));
    }

    @GetMapping("/item-master/agencies")
    public List<Map<String, Object>> getItemMasterAgencies(@RequestParam(name = "q", defaultValue = "") String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase();
        String like = "%" + normalized + "%";
        return jdbcTemplate.queryForList(
                """
                SELECT a.id,
                       a.name,
                       a.gstin,
                       a.phone,
                       a.address,
                       COUNT(DISTINCT b.id) AS bill_count,
                       COUNT(mid.id) AS mapped_rows,
                       MAX(b.created_at) AS last_bill_at
                FROM inventory_agencies a
                LEFT JOIN agency_bills b ON b.agency_id = a.id
                LEFT JOIN medicine_inventory_details mid ON mid.agency_bill_id = b.id
                WHERE (? = ''
                  OR lower(COALESCE(a.name, '')) LIKE ?
                  OR lower(COALESCE(a.gstin, '')) LIKE ?
                  OR lower(COALESCE(a.address, '')) LIKE ?)
                GROUP BY a.id, a.name, a.gstin, a.phone, a.address
                ORDER BY MAX(b.id) DESC, a.id DESC
                """,
                normalized,
                like,
                like,
                like
        );
    }

    @GetMapping("/item-master/agencies/{agencyId}/bills")
    public List<Map<String, Object>> getAgencyBills(@PathVariable Long agencyId) {
        return jdbcTemplate.queryForList(
                """
                SELECT b.id,
                       b.agency_id,
                       b.invoice_no,
                       b.bill_number,
                       b.invoice_date,
                       ROUND(COALESCE(b.bill_total, 0), 2) AS bill_total,
                       ROUND(COALESCE(b.bill_total, 0), 2) AS ocr_total,
                       ROUND(COALESCE(SUM(COALESCE(mid.rate, 0) * COALESCE(mid.quantity_added, 0)), 0), 2) AS calculated_total,
                       CASE
                         WHEN ABS(ROUND(COALESCE(b.bill_total, 0), 2) - ROUND(COALESCE(SUM(COALESCE(mid.rate, 0) * COALESCE(mid.quantity_added, 0)), 0), 2)) > 1
                         THEN 1 ELSE 0
                       END AS total_mismatch,
                       b.file_name,
                       b.created_at,
                       COUNT(mid.id) AS mapped_rows,
                       COALESCE(SUM(mid.quantity_added), 0) AS total_units
                FROM agency_bills b
                LEFT JOIN medicine_inventory_details mid ON mid.agency_bill_id = b.id
                WHERE b.agency_id = ?
                GROUP BY b.id, b.agency_id, b.invoice_no, b.bill_number, b.invoice_date, b.bill_total, b.file_name, b.created_at
                ORDER BY b.id DESC
                """,
                agencyId
        );
    }

    @GetMapping("/item-master/bills/{billId}")
    public ResponseEntity<?> getBillDetails(@PathVariable Long billId) {
        List<Map<String, Object>> billRows = jdbcTemplate.queryForList(
                """
                SELECT b.id,
                       b.agency_id,
                       a.name AS agency_name,
                       a.gstin AS agency_gstin,
                       a.phone AS agency_phone,
                       a.address AS agency_address,
                       b.invoice_no,
                       b.bill_number,
                       b.invoice_date,
                       ROUND(COALESCE(b.bill_total, 0), 2) AS bill_total,
                       ROUND(COALESCE(b.bill_total, 0), 2) AS ocr_total,
                       ROUND(COALESCE(SUM(COALESCE(mid.rate, 0) * COALESCE(mid.quantity_added, 0)), 0), 2) AS calculated_total,
                       CASE
                         WHEN ABS(ROUND(COALESCE(b.bill_total, 0), 2) - ROUND(COALESCE(SUM(COALESCE(mid.rate, 0) * COALESCE(mid.quantity_added, 0)), 0), 2)) > 1
                         THEN 1 ELSE 0
                       END AS total_mismatch,
                       b.file_name,
                       b.created_at
                FROM agency_bills b
                JOIN inventory_agencies a ON a.id = b.agency_id
                LEFT JOIN medicine_inventory_details mid ON mid.agency_bill_id = b.id
                WHERE b.id = ?
                GROUP BY b.id, b.agency_id, a.name, a.gstin, a.phone, a.address, b.invoice_no, b.bill_number, b.invoice_date, b.bill_total, b.file_name, b.created_at
                LIMIT 1
                """,
                billId
        );
        if (billRows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Bill not found"));
        }

        List<Map<String, Object>> medicines = jdbcTemplate.queryForList(
                """
                SELECT mid.id,
                       mid.medicine_id,
                       m.name AS medicine_name,
                       m.brand AS medicine_brand,
                       mid.batch,
                       mid.expiry,
                       mid.qty_fr,
                       mid.quantity_added,
                       mid.bonus,
                       ROUND(mid.rate, 2) AS effective_rate,
                       ROUND(mid.mrp, 2) AS mrp,
                       ROUND(mid.amount, 2) AS amount,
                       mid.manufacturer,
                       mid.hsn,
                       mid.pack,
                       mid.created_at
                FROM medicine_inventory_details mid
                JOIN medicines m ON m.id = mid.medicine_id
                WHERE mid.agency_bill_id = ?
                ORDER BY mid.id DESC
                """,
                billId
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bill", billRows.get(0));
        payload.put("medicines", medicines);
        payload.put("summary", Map.of(
                "line_items", medicines.size(),
                "total_units_added", medicines.stream().mapToInt(row -> ((Number) row.getOrDefault("quantity_added", 0)).intValue()).sum()
        ));
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/prescriptions")
    public List<Map<String, Object>> getPrescriptionQueue() {
        return jdbcTemplate.queryForList(
                """
                SELECT p.id, p.user_id, u.email as user_email, p.status, p.created_at,
                       COUNT(pf.id) as file_count
                FROM prescriptions p
                JOIN users u ON u.id = p.user_id
                LEFT JOIN prescription_files pf ON pf.prescription_id = p.id
                GROUP BY p.id, p.user_id, u.email, p.status, p.created_at
                ORDER BY p.id DESC
                """
        );
    }

    @PutMapping("/prescriptions/{prescriptionId}")
    public ResponseEntity<?> updatePrescriptionStatus(
            @PathVariable Long prescriptionId,
            @RequestBody Map<String, String> request
    ) {
        String status = request.getOrDefault("status", "").trim().toLowerCase();
        if (!List.of("uploaded", "in_review", "approved", "rejected").contains(status)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid status"));
        }

        int updated = jdbcTemplate.update(
                "UPDATE prescriptions SET status = ? WHERE id = ?",
                status,
                prescriptionId
        );
        if (updated == 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Prescription not found"));
        }
        return ResponseEntity.ok(Map.of("message", "Prescription status updated"));
    }

    private static String valueOrCurrentString(Map<String, Object> request, String key, Object currentValue) {
        Object raw = request.get(key);
        if (raw == null) {
            return currentValue == null ? "" : String.valueOf(currentValue);
        }
        return String.valueOf(raw).trim();
    }

    private static double valueOrCurrentDouble(Map<String, Object> request, String key, Object currentValue) {
        Object raw = request.get(key);
        if (raw == null) {
            return currentValue instanceof Number number ? number.doubleValue() : 0;
        }
        if (raw instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (NumberFormatException ignored) {
            return currentValue instanceof Number number ? number.doubleValue() : 0;
        }
    }

    private static int valueOrCurrentInt(Map<String, Object> request, String key, Object currentValue) {
        Object raw = request.get(key);
        if (raw == null) {
            return currentValue instanceof Number number ? number.intValue() : 0;
        }
        if (raw instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (NumberFormatException ignored) {
            return currentValue instanceof Number number ? number.intValue() : 0;
        }
    }

    private static int valueOrCurrentBooleanInt(Map<String, Object> request, String key, Object currentValue) {
        Object raw = request.get(key);
        if (raw == null) {
            return currentValue instanceof Number number ? number.intValue() : 0;
        }
        if (raw instanceof Boolean bool) {
            return bool ? 1 : 0;
        }
        if (raw instanceof Number number) {
            return number.intValue() > 0 ? 1 : 0;
        }
        String value = String.valueOf(raw).trim().toLowerCase();
        return ("true".equals(value) || "1".equals(value) || "yes".equals(value)) ? 1 : 0;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private long resolveOrCreateMedicine(String name, String brand, String description, String category, double rate, double mrp, int stockToAdd) {
        List<Long> existing = jdbcTemplate.query(
                "SELECT id FROM medicines WHERE lower(name) = lower(?) AND lower(COALESCE(brand, '')) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                name.trim(),
                brand == null ? "" : brand.trim()
        );
        if (!existing.isEmpty()) {
            long id = existing.get(0);
            jdbcTemplate.update(
                    "UPDATE medicines SET stock = stock + ?, price = ?, mrp = CASE WHEN mrp IS NULL OR mrp < ? THEN ? ELSE mrp END WHERE id = ?",
                    stockToAdd,
                    rate,
                    mrp,
                    mrp,
                    id
            );
            return id;
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO medicines (name, description, price, stock, category, brand, mrp, discount_percent, requires_prescription, rating, image_url, delivery_eta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, name.trim());
            ps.setString(2, description.isBlank() ? "Added manually by admin" : description);
            ps.setDouble(3, rate);
            ps.setInt(4, stockToAdd);
            ps.setString(5, category.isBlank() ? "Inventory Intake" : category);
            ps.setString(6, brand.isBlank() ? "Unspecified" : brand);
            ps.setDouble(7, mrp > 0 ? mrp : rate);
            ps.setInt(8, 0);
            ps.setInt(9, 0);
            ps.setDouble(10, 4.0);
            ps.setString(11, "https://picsum.photos/seed/" + name.toLowerCase().replaceAll("[^a-z0-9]+", "-") + "/400/300");
            ps.setString(12, "Today");
            return ps;
        }, keyHolder);
        if (keyHolder.getKey() == null) {
            throw new IllegalStateException("Unable to create medicine");
        }
        return keyHolder.getKey().longValue();
    }

    private Long resolveAgencyBillForManualEntry(String linkageType, Map<String, Object> request) {
        if ("none".equals(linkageType)) {
            return null;
        }
        if ("bill".equals(linkageType)) {
            long billId = valueOrCurrentInt(request, "bill_id", 0);
            if (billId <= 0) {
                throw new IllegalArgumentException("Select a bill for bill linkage");
            }
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM agency_bills WHERE id = ?",
                    Integer.class,
                    billId
            );
            if (count == null || count == 0) {
                throw new IllegalArgumentException("Selected bill does not exist");
            }
            return billId;
        }
        if ("agency".equals(linkageType)) {
            long agencyId = valueOrCurrentInt(request, "agency_id", 0);
            if (agencyId <= 0) {
                throw new IllegalArgumentException("Select an agency for agency linkage");
            }
            String invoiceNo = valueOrCurrentString(request, "invoice_no", "");
            String billNumber = valueOrCurrentString(request, "bill_number", "");
            String invoiceDate = valueOrCurrentString(request, "invoice_date", "");
            double billTotal = round2(valueOrCurrentDouble(request, "bill_total", 0));

            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement(
                        "INSERT INTO agency_bills (agency_id, invoice_no, bill_number, invoice_date, bill_total, file_name, raw_metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        Statement.RETURN_GENERATED_KEYS
                );
                ps.setLong(1, agencyId);
                ps.setString(2, invoiceNo.isBlank() ? "MANUAL-" + System.currentTimeMillis() : invoiceNo);
                ps.setString(3, billNumber);
                ps.setString(4, invoiceDate);
                ps.setDouble(5, billTotal);
                ps.setString(6, "manual-entry");
                ps.setString(7, "{\"source\":\"manual\"}");
                return ps;
            }, keyHolder);
            if (keyHolder.getKey() == null) {
                throw new IllegalStateException("Unable to create agency bill linkage");
            }
            return keyHolder.getKey().longValue();
        }
        throw new IllegalArgumentException("Invalid linkage type");
    }
}
