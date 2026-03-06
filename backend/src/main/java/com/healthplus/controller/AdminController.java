package com.healthplus.controller;

import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private static final Set<String> ALLOWED_BILL_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png");
    private static final long MAX_BILL_SIZE_BYTES = 10L * 1024 * 1024;

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
                SELECT o.id, o.user_id, u.email as user_email, o.total_price, o.status, o.payment_status, o.payment_method, o.created_at
                FROM orders o
                LEFT JOIN users u ON u.id = o.user_id
                ORDER BY o.id DESC
                """
        );
    }

    @GetMapping("/medicines")
    public List<Map<String, Object>> getMedicines() {
        return jdbcTemplate.queryForList(
                "SELECT id, name, description, price, stock, brand, category, requires_prescription FROM medicines ORDER BY id DESC"
        );
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

    @PostMapping("/inventory/bills/upload")
    public ResponseEntity<?> uploadAgencyBill(
            Authentication authentication,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "agency_name", required = false) String agencyName,
            @RequestParam(value = "invoice_number", required = false) String invoiceNumber,
            @RequestParam(value = "invoice_date", required = false) String invoiceDate
    ) {
        try {
            LocalUser admin = localUserService.resolveOrCreate(authentication);
            validateBillFile(file);

            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement(
                        "INSERT INTO agency_bills (uploaded_by, agency_name, invoice_number, invoice_date, source_file_name, stored_file_path, status, ocr_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'uploaded', 'pending', CURRENT_TIMESTAMP)",
                        Statement.RETURN_GENERATED_KEYS
                );
                ps.setLong(1, admin.id());
                ps.setString(2, normalize(agencyName));
                ps.setString(3, normalize(invoiceNumber));
                ps.setString(4, normalize(invoiceDate));
                ps.setString(5, Optional.ofNullable(file.getOriginalFilename()).orElse("bill"));
                ps.setString(6, "pending");
                return ps;
            }, keyHolder);

            Long billId = keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
            if (billId == null) {
                throw new IllegalStateException("Unable to create bill record");
            }

            String extension = getExtension(Optional.ofNullable(file.getOriginalFilename()).orElse("bill.pdf"));
            String storedName = UUID.randomUUID() + "." + extension;
            Path uploadDir = Paths.get("..", "uploads", "agency-bills", String.valueOf(billId));
            Files.createDirectories(uploadDir);
            Path destination = uploadDir.resolve(storedName).normalize();
            file.transferTo(destination);

            jdbcTemplate.update(
                    "UPDATE agency_bills SET stored_file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    destination.toString(),
                    billId
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "id", billId,
                    "status", "uploaded",
                    "ocr_status", "pending"
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unable to store bill file"));
        }
    }

    @GetMapping("/inventory/bills")
    public List<Map<String, Object>> getInventoryBills() {
        return jdbcTemplate.queryForList(
                "SELECT id, uploaded_by, agency_name, invoice_number, invoice_date, status, ocr_status, created_at FROM agency_bills ORDER BY id DESC"
        );
    }

    @GetMapping("/inventory/bills/{billId}")
    public ResponseEntity<?> getInventoryBill(@PathVariable Long billId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, uploaded_by, agency_name, invoice_number, invoice_date, status, ocr_status, source_file_name, created_at FROM agency_bills WHERE id = ?",
                billId
        );
        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Bill not found"));
        }

        List<Map<String, Object>> items = jdbcTemplate.queryForList(
                "SELECT id, raw_medicine_name, normalized_medicine_name, batch_no, expiry_date, quantity, purchase_price, mrp, match_medicine_id, resolution_status, notes FROM agency_bill_items WHERE bill_id = ? ORDER BY id",
                billId
        );

        return ResponseEntity.ok(Map.of(
                "bill", rows.get(0),
                "items", items
        ));
    }

    @PostMapping("/inventory/bills/{billId}/items")
    public ResponseEntity<?> addBillItem(@PathVariable Long billId, @RequestBody Map<String, Object> request) {
        String rawName = normalize(String.valueOf(request.getOrDefault("raw_medicine_name", "")));
        if (rawName == null || rawName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "raw_medicine_name is required"));
        }

        String normalizedName = normalize(String.valueOf(request.getOrDefault("normalized_medicine_name", rawName)));
        Integer quantity = parseOptionalInt(request.get("quantity"));
        Double purchasePrice = parseOptionalDouble(request.get("purchase_price"));
        Double mrp = parseOptionalDouble(request.get("mrp"));
        Long matchMedicineId = parseOptionalLong(request.get("match_medicine_id"));
        String resolutionStatus = normalize(String.valueOf(request.getOrDefault("resolution_status", "ready")));

        jdbcTemplate.update(
                "INSERT INTO agency_bill_items (bill_id, raw_medicine_name, normalized_medicine_name, batch_no, expiry_date, quantity, purchase_price, mrp, match_medicine_id, resolution_status, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                billId,
                rawName,
                normalizedName,
                normalize(String.valueOf(request.getOrDefault("batch_no", ""))),
                normalize(String.valueOf(request.getOrDefault("expiry_date", ""))),
                quantity,
                purchasePrice,
                mrp,
                matchMedicineId,
                resolutionStatus == null ? "ready" : resolutionStatus,
                normalize(String.valueOf(request.getOrDefault("notes", "")))
        );

        jdbcTemplate.update("UPDATE agency_bills SET status = 'reviewed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", billId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Bill item added"));
    }

    @PutMapping("/inventory/bills/{billId}/items/{itemId}")
    public ResponseEntity<?> updateBillItem(@PathVariable Long billId, @PathVariable Long itemId, @RequestBody Map<String, Object> request) {
        int updated = jdbcTemplate.update(
                "UPDATE agency_bill_items SET normalized_medicine_name = ?, quantity = ?, purchase_price = ?, mrp = ?, match_medicine_id = ?, resolution_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND bill_id = ?",
                normalize(String.valueOf(request.getOrDefault("normalized_medicine_name", ""))),
                parseOptionalInt(request.get("quantity")),
                parseOptionalDouble(request.get("purchase_price")),
                parseOptionalDouble(request.get("mrp")),
                parseOptionalLong(request.get("match_medicine_id")),
                normalize(String.valueOf(request.getOrDefault("resolution_status", "needs_review"))),
                normalize(String.valueOf(request.getOrDefault("notes", ""))),
                itemId,
                billId
        );
        if (updated == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Bill item not found"));
        }
        return ResponseEntity.ok(Map.of("message", "Bill item updated"));
    }

    @PostMapping("/inventory/bills/{billId}/import")
    public ResponseEntity<?> importBillToInventory(Authentication authentication, @PathVariable Long billId) {
        LocalUser admin = localUserService.resolveOrCreate(authentication);

        List<Map<String, Object>> items = jdbcTemplate.queryForList(
                "SELECT id, normalized_medicine_name, quantity, purchase_price, mrp, match_medicine_id, resolution_status FROM agency_bill_items WHERE bill_id = ?",
                billId
        );

        if (items.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No bill items to import"));
        }

        int importedCount = 0;
        for (Map<String, Object> item : items) {
            String status = String.valueOf(item.getOrDefault("resolution_status", "needs_review"));
            if (!List.of("ready", "matched", "approved").contains(status)) {
                continue;
            }

            Integer quantity = parseOptionalInt(item.get("quantity"));
            if (quantity == null || quantity <= 0) {
                continue;
            }

            Long medicineId = resolveMedicineId(item);
            if (medicineId == null) {
                continue;
            }

            jdbcTemplate.update(
                    "UPDATE medicines SET stock = COALESCE(stock, 0) + ? WHERE id = ?",
                    quantity,
                    medicineId
            );

            jdbcTemplate.update(
                    "INSERT INTO medicine_stock_ledger (medicine_id, delta_quantity, reason, reference_type, reference_id, created_by) VALUES (?, ?, 'agency_bill_import', 'agency_bill_item', ?, ?)",
                    medicineId,
                    quantity,
                    item.get("id"),
                    admin.id()
            );
            importedCount++;
        }

        if (importedCount == 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "No eligible items found. Mark items as ready/matched/approved with quantity > 0."));
        }

        jdbcTemplate.update(
                "UPDATE agency_bills SET status = 'imported', ocr_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                billId
        );

        return ResponseEntity.ok(Map.of(
                "message", "Bill imported into inventory",
                "imported_items", importedCount
        ));
    }

    private Long resolveMedicineId(Map<String, Object> item) {
        Long medicineId = parseOptionalLong(item.get("match_medicine_id"));
        if (medicineId != null) {
            return medicineId;
        }

        String medicineName = normalize(String.valueOf(item.getOrDefault("normalized_medicine_name", "")));
        if (medicineName == null || medicineName.isBlank()) {
            return null;
        }

        List<Long> matched = jdbcTemplate.query(
                "SELECT id FROM medicines WHERE lower(name) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                medicineName
        );
        if (!matched.isEmpty()) {
            return matched.get(0);
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        Double purchasePrice = parseOptionalDouble(item.get("purchase_price"));
        Double mrp = parseOptionalDouble(item.get("mrp"));
        double fallbackPrice = mrp != null && mrp > 0 ? mrp : (purchasePrice != null && purchasePrice > 0 ? purchasePrice : 1.0);

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO medicines (name, description, price, stock) VALUES (?, '', ?, 0)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, medicineName);
            ps.setDouble(2, fallbackPrice);
            return ps;
        }, keyHolder);

        return keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
    }

    private void validateBillFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Bill file is required");
        }
        if (file.getSize() > MAX_BILL_SIZE_BYTES) {
            throw new IllegalArgumentException("Bill file must be 10 MB or smaller");
        }

        String extension = getExtension(Optional.ofNullable(file.getOriginalFilename()).orElse(""));
        if (!ALLOWED_BILL_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Only PDF, JPG, JPEG, PNG files are allowed for bill upload");
        }
    }

    private String getExtension(String name) {
        int idx = name.lastIndexOf('.');
        if (idx < 0 || idx == name.length() - 1) return "";
        return name.substring(idx + 1).toLowerCase(Locale.ROOT);
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private Integer parseOptionalInt(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return null;
        return Integer.parseInt(text);
    }

    private Double parseOptionalDouble(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return null;
        return Double.parseDouble(text);
    }

    private Long parseOptionalLong(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return null;
        return Long.parseLong(text);
    }
}
