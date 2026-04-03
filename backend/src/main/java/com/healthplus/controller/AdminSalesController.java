package com.healthplus.controller;

import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import com.healthplus.service.AdminSalesService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/sales")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSalesController {
    private final AdminSalesService adminSalesService;
    private final LocalUserService localUserService;

    public AdminSalesController(AdminSalesService adminSalesService, LocalUserService localUserService) {
        this.adminSalesService = adminSalesService;
        this.localUserService = localUserService;
    }

    @GetMapping
    public List<Map<String, Object>> listSales(@RequestParam(name = "q", defaultValue = "") String query) {
        return adminSalesService.listSales(query);
    }

    @GetMapping("/{saleId}")
    public ResponseEntity<?> getSale(@PathVariable Long saleId) {
        try {
            return ResponseEntity.ok(adminSalesService.getSaleById(saleId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createSale(@RequestBody Map<String, Object> request, Authentication authentication) {
        try {
            LocalUser admin = localUserService.resolveOrCreate(authentication);
            Map<String, Object> response = adminSalesService.createSale(request, admin.id());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PutMapping("/{saleId}")
    public ResponseEntity<?> updateSale(
            @PathVariable Long saleId,
            @RequestBody Map<String, Object> request,
            Authentication authentication
    ) {
        try {
            LocalUser admin = localUserService.resolveOrCreate(authentication);
            return ResponseEntity.ok(adminSalesService.updateSale(saleId, request, admin.id()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/patients")
    public List<Map<String, Object>> searchPatients(@RequestParam(name = "q", defaultValue = "") String query) {
        return adminSalesService.searchPatients(query);
    }

    @PostMapping("/patients")
    public ResponseEntity<?> createPatient(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(adminSalesService.createPatient(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/doctors")
    public List<Map<String, Object>> searchDoctors(@RequestParam(name = "q", defaultValue = "") String query) {
        return adminSalesService.searchDoctors(query);
    }

    @PostMapping("/doctors")
    public ResponseEntity<?> createDoctor(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(adminSalesService.createDoctor(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/medicines")
    public List<Map<String, Object>> searchMedicines(@RequestParam(name = "q", defaultValue = "") String query) {
        return adminSalesService.searchMedicinesForSale(query);
    }

    @GetMapping("/medicines/{medicineId}/lots")
    public List<Map<String, Object>> getMedicineLots(@PathVariable Long medicineId) {
        return adminSalesService.listMedicineLots(medicineId);
    }
}
