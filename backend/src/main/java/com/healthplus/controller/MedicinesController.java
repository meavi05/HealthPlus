package com.healthplus.controller;

import com.healthplus.dto.MedicinesResponse;
import com.healthplus.service.MedicineService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/medicines")
public class MedicinesController {
    private final MedicineService medicineService;

    public MedicinesController(MedicineService medicineService) {
        this.medicineService = medicineService;
    }

    @GetMapping
    public MedicinesResponse getMedicines(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return medicineService.getMedicines(page, limit);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> getCategories() {
        return medicineService.getCategories();
    }

    @GetMapping("/brands")
    public List<Map<String, Object>> getBrands() {
        return medicineService.getBrands();
    }

    @GetMapping("/suggest")
    public List<Map<String, Object>> suggest(@RequestParam("q") String query) {
        return medicineService.suggest(query == null ? "" : query);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getMedicineById(@PathVariable Long id) {
        return medicineService.getMedicineById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Medicine not found")));
    }

    @GetMapping("/{id}/substitutes")
    public List<Map<String, Object>> getSubstitutes(@PathVariable Long id) {
        return medicineService.getSubstitutes(id);
    }
}
