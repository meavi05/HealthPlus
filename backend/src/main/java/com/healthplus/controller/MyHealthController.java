package com.healthplus.controller;

import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import com.healthplus.service.MedicineRoutineService;
import com.healthplus.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/my-health")
public class MyHealthController {
    private final PrescriptionService prescriptionService;
    private final MedicineRoutineService medicineRoutineService;
    private final LocalUserService localUserService;

    public MyHealthController(PrescriptionService prescriptionService, MedicineRoutineService medicineRoutineService, LocalUserService localUserService) {
        this.prescriptionService = prescriptionService;
        this.medicineRoutineService = medicineRoutineService;
        this.localUserService = localUserService;
    }

    @PostMapping("/prescriptions/upload")
    public ResponseEntity<?> uploadPrescription(Authentication authentication, @RequestParam("files") List<MultipartFile> files) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            Map<String, Object> response = prescriptionService.uploadPrescription(current.id(), files);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/routines")
    public ResponseEntity<?> getRoutines(Authentication authentication) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            return ResponseEntity.ok(medicineRoutineService.getRoutines(current.id()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/medicines")
    public ResponseEntity<?> getUserMedicines(Authentication authentication) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            return ResponseEntity.ok(medicineRoutineService.getPurchasedMedicines(current.id()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/routines")
    public ResponseEntity<?> createRoutine(Authentication authentication, @RequestBody Map<String, Object> request) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            String medicineName = String.valueOf(request.getOrDefault("medicine_name", ""));
            String lastTakenDate = String.valueOf(request.getOrDefault("last_taken_date", ""));
            Map<String, Object> payload = medicineRoutineService.createRoutine(current.id(), medicineName, lastTakenDate);
            return ResponseEntity.status(HttpStatus.CREATED).body(payload);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
