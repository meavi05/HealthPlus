package com.healthplus.controller;

import com.healthplus.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionsController {
    private final PrescriptionService prescriptionService;

    public PrescriptionsController(PrescriptionService prescriptionService) {
        this.prescriptionService = prescriptionService;
    }

    @PostMapping("/upload")
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
}
