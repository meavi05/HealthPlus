package com.healthplus.service;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final JdbcTemplate jdbcTemplate;

    public AdminController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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
}
