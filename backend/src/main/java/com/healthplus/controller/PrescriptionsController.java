package com.healthplus.controller;

import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import com.healthplus.service.PrescriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
    private final LocalUserService localUserService;

    public PrescriptionsController(PrescriptionService prescriptionService, LocalUserService localUserService) {
        this.prescriptionService = prescriptionService;
        this.localUserService = localUserService;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadPrescription(Authentication authentication, @RequestParam("files") List<MultipartFile> files) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            Map<String, Object> response = prescriptionService.uploadPrescription(current.id(), files);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
