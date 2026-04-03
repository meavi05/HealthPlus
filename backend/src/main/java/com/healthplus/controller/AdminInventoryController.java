package com.healthplus.controller;

import com.healthplus.service.InventoryReceiptOcrService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/inventory")
@PreAuthorize("hasRole('ADMIN')")
public class AdminInventoryController {
    private final InventoryReceiptOcrService inventoryReceiptOcrService;

    public AdminInventoryController(InventoryReceiptOcrService inventoryReceiptOcrService) {
        this.inventoryReceiptOcrService = inventoryReceiptOcrService;
    }

    @PostMapping("/ocr-preview")
    public ResponseEntity<?> previewInventoryReceipt(@RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> response = inventoryReceiptOcrService.previewReceipt(file);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/ocr-apply")
    public ResponseEntity<?> applyReviewedInventoryReceipt(@RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> response = inventoryReceiptOcrService.applyReviewedReceipt(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}