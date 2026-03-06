package com.healthplus.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

@Service
public class PrescriptionService {
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final int MAX_FILES = 2;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png");

    private final JdbcTemplate jdbcTemplate;

    public PrescriptionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public Map<String, Object> uploadPrescription(Long userId, List<MultipartFile> files) {
        if (userId == null) {
            throw new IllegalArgumentException("user_id is required");
        }

        Integer userCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE id = ?",
                Integer.class,
                userId
        );
        if (userCount == null || userCount == 0) {
            throw new IllegalArgumentException("User not found");
        }

        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("At least one file is required");
        }

        if (files.size() > MAX_FILES) {
            throw new IllegalArgumentException("You can upload a maximum of 2 files");
        }

        validateFiles(files);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO prescriptions (user_id, status) VALUES (?, 'uploaded')",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, userId);
            return ps;
        }, keyHolder);

        Long prescriptionId = keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
        if (prescriptionId == null) {
            throw new IllegalStateException("Failed to create prescription record");
        }

        List<Map<String, Object>> uploaded = new ArrayList<>();
        Path uploadDir = Paths.get("..", "uploads", "prescriptions", String.valueOf(userId), String.valueOf(prescriptionId));

        try {
            Files.createDirectories(uploadDir);
            for (MultipartFile file : files) {
                String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("file");
                String extension = getExtension(originalName);
                String storedName = UUID.randomUUID() + "." + extension;
                Path destination = uploadDir.resolve(storedName).normalize();

                file.transferTo(destination);

                jdbcTemplate.update(
                        "INSERT INTO prescription_files (prescription_id, original_file_name, stored_file_name, file_path, content_type, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?)",
                        prescriptionId,
                        originalName,
                        storedName,
                        destination.toString(),
                        Optional.ofNullable(file.getContentType()).orElse("application/octet-stream"),
                        file.getSize()
                );

                uploaded.add(Map.of(
                        "original_name", originalName,
                        "stored_name", storedName,
                        "size", file.getSize()
                ));
            }
        } catch (IOException ioException) {
            throw new IllegalArgumentException("Failed to store prescription files");
        }

        return Map.of(
                "id", prescriptionId,
                "user_id", userId,
                "status", "uploaded",
                "files", uploaded
        );
    }

    private void validateFiles(List<MultipartFile> files) {
        for (MultipartFile file : files) {
            if (file.isEmpty()) {
                throw new IllegalArgumentException("Uploaded file cannot be empty");
            }
            if (file.getSize() > MAX_FILE_SIZE_BYTES) {
                throw new IllegalArgumentException("Each file must be 5 MB or smaller");
            }

            String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("");
            String extension = getExtension(originalName);
            if (!ALLOWED_EXTENSIONS.contains(extension)) {
                throw new IllegalArgumentException("Only PDF, JPG, JPEG, or PNG files are allowed");
            }
        }
    }

    private String getExtension(String filename) {
        int idx = filename.lastIndexOf('.');
        if (idx == -1 || idx == filename.length() - 1) {
            return "";
        }
        return filename.substring(idx + 1).toLowerCase(Locale.ROOT);
    }
}
