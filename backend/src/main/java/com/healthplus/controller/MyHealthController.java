package com.healthplus.controller;

import com.healthplus.service.MedicineRoutineService;
import com.healthplus.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/my-health")
public class MyHealthController {
    private final PrescriptionService prescriptionService;
    private final MedicineRoutineService medicineRoutineService;

    public MyHealthController(PrescriptionService prescriptionService, MedicineRoutineService medicineRoutineService) {
        this.prescriptionService = prescriptionService;
        this.medicineRoutineService = medicineRoutineService;
    }

    @PostMapping("/prescriptions/upload")
    public ResponseEntity<?> uploadPrescription(
            @RequestParam("user_id") Long userId,
            @RequestParam("files") List<MultipartFile> files
    ) {
        try {
            Map<String, Object> response = prescriptionService.uploadPrescription(userId, files);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/routines")
    public ResponseEntity<?> getRoutines(@RequestParam("user_id") Long userId) {
        try {
            return ResponseEntity.ok(medicineRoutineService.getRoutines(userId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/routines")
    public ResponseEntity<?> createRoutine(@RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.parseLong(String.valueOf(request.get("user_id")));
            String medicineName = String.valueOf(request.getOrDefault("medicine_name", ""));
            String lastTakenDate = String.valueOf(request.getOrDefault("last_taken_date", ""));
            Map<String, Object> payload = medicineRoutineService.createRoutine(userId, medicineName, lastTakenDate);
            return ResponseEntity.status(HttpStatus.CREATED).body(payload);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
