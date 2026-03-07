package com.healthplus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class InventoryReceiptOcrService {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public InventoryReceiptOcrService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> processReceipt(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Receipt file is required");
        }

        List<Map<String, Object>> steps = new ArrayList<>();
        steps.add(step("validate-upload", "success", "Upload received", Map.of(
                "file_name", file.getOriginalFilename() == null ? "unknown" : file.getOriginalFilename(),
                "content_type", file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
                "size_bytes", file.getSize()
        )));

        List<InventoryRow> rows = extractRows(file, steps);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("No medicine rows were detected from receipt");
        }

        int inserted = 0;
        int updated = 0;
        List<Map<String, Object>> outcomes = new ArrayList<>();

        for (InventoryRow row : rows) {
            List<Long> existingIds = jdbcTemplate.query(
                    "SELECT id FROM medicines WHERE lower(name) = lower(?) AND lower(COALESCE(brand, '')) = lower(?) LIMIT 1",
                    (rs, rowNum) -> rs.getLong("id"),
                    row.name(),
                    row.brand()
            );

            if (!existingIds.isEmpty()) {
                Long id = existingIds.get(0);
                jdbcTemplate.update(
                        "UPDATE medicines SET stock = stock + ?, price = ?, mrp = CASE WHEN mrp IS NULL OR mrp < ? THEN ? ELSE mrp END WHERE id = ?",
                        row.quantity(),
                        row.unitPrice(),
                        row.unitPrice(),
                        row.unitPrice(),
                        id
                );
                updated++;
                outcomes.add(Map.of(
                        "action", "updated",
                        "medicine_id", id,
                        "name", row.name(),
                        "brand", row.brand(),
                        "stock_added", row.quantity(),
                        "unit_price", row.unitPrice()
                ));
                continue;
            }

            jdbcTemplate.update(
                    "INSERT INTO medicines (name, description, price, stock, category, brand, mrp, discount_percent, requires_prescription, rating, image_url, delivery_eta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    row.name(),
                    "Added from agency receipt OCR ingestion",
                    row.unitPrice(),
                    row.quantity(),
                    "Inventory Intake",
                    row.brand().isBlank() ? "Unspecified" : row.brand(),
                    row.unitPrice(),
                    0,
                    0,
                    4.0,
                    "https://picsum.photos/seed/" + sanitizeSeed(row.name()) + "/400/300",
                    "Today"
            );
            inserted++;
            outcomes.add(Map.of(
                    "action", "inserted",
                    "name", row.name(),
                    "brand", row.brand(),
                    "stock_added", row.quantity(),
                    "unit_price", row.unitPrice()
            ));
        }

        steps.add(step("inventory-upsert", "success", "Rows inserted into medicines inventory", Map.of(
                "rows_detected", rows.size(),
                "inserted", inserted,
                "updated", updated
        )));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Receipt OCR processed and inventory updated");
        response.put("steps", steps);
        response.put("summary", Map.of("rows_detected", rows.size(), "inserted", inserted, "updated", updated));
        response.put("rows", outcomes);
        return response;
    }

    private List<InventoryRow> extractRows(MultipartFile file, List<Map<String, Object>> steps) {
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        if (contentType.startsWith("text/") || fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
            List<InventoryRow> csvRows = extractFromCsv(file);
            steps.add(step("ocr-extraction", "success", "Parsed receipt rows from text/csv file", Map.of("rows", csvRows.size(), "source", "text")));
            return csvRows;
        }

        List<InventoryRow> aiRows = extractWithGemini(file);
        steps.add(step("ocr-extraction", "success", "OCR completed using Gemini vision model", Map.of("rows", aiRows.size(), "source", "gemini")));
        return aiRows;
    }

    private List<InventoryRow> extractFromCsv(MultipartFile file) {
        try {
            String text = new String(file.getBytes(), StandardCharsets.UTF_8);
            List<InventoryRow> rows = new ArrayList<>();
            for (String rawLine : text.split("\\R")) {
                String line = rawLine.trim();
                if (line.isBlank() || line.toLowerCase(Locale.ROOT).startsWith("name,")) {
                    continue;
                }
                String[] parts = line.split(",");
                if (parts.length < 3) {
                    continue;
                }
                String name = parts[0].trim();
                String brand = parts.length >= 4 ? parts[3].trim() : "";
                int quantity = parseQuantity(parts[1]);
                double unitPrice = parsePrice(parts[2]);
                if (name.isBlank() || quantity <= 0 || unitPrice <= 0) {
                    continue;
                }
                rows.add(new InventoryRow(name, brand, quantity, unitPrice));
            }
            return rows;
        } catch (IOException ex) {
            throw new IllegalArgumentException("Unable to parse receipt file");
        }
    }

    private List<InventoryRow> extractWithGemini(MultipartFile file) {
        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("GEMINI_API_KEY is required for OCR on image/pdf receipts. Use csv/txt upload or set key.");
        }

        try {
            byte[] bytes = file.getBytes();
            String encoded = Base64.getEncoder().encodeToString(bytes);
            String mimeType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();

            String prompt = "You are extracting medicine inventory rows from a medical agency bill receipt. " +
                    "Return strict JSON only with this shape: {\"items\":[{\"name\":string,\"brand\":string,\"quantity\":number,\"unit_price\":number}]}. " +
                    "If uncertain, do best-effort. Ignore totals/taxes. No markdown.";

            Map<String, Object> payload = Map.of(
                    "contents", List.of(Map.of("parts", List.of(
                            Map.of("text", prompt),
                            Map.of("inline_data", Map.of("mime_type", mimeType, "data", encoded))
                    )))
            );

            URL url = URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey).toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(45000);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            connection.getOutputStream().write(objectMapper.writeValueAsBytes(payload));

            int status = connection.getResponseCode();
            byte[] responseBytes = status >= 200 && status < 300
                    ? connection.getInputStream().readAllBytes()
                    : connection.getErrorStream().readAllBytes();

            if (status < 200 || status >= 300) {
                throw new IllegalArgumentException("Gemini OCR failed with status " + status + ": " + new String(responseBytes, StandardCharsets.UTF_8));
            }

            JsonNode root = objectMapper.readTree(responseBytes);
            JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (textNode.isMissingNode() || textNode.asText().isBlank()) {
                throw new IllegalArgumentException("Gemini OCR did not return extractable text");
            }

            String jsonText = stripMarkdownFence(textNode.asText());
            JsonNode extracted = objectMapper.readTree(jsonText);
            JsonNode items = extracted.path("items");
            if (!items.isArray()) {
                throw new IllegalArgumentException("Gemini OCR response missing items array");
            }

            List<InventoryRow> rows = new ArrayList<>();
            for (JsonNode item : items) {
                String name = item.path("name").asText("").trim();
                String brand = item.path("brand").asText("").trim();
                int quantity = parseQuantity(item.path("quantity").asText("0"));
                double unitPrice = parsePrice(item.path("unit_price").asText("0"));
                if (name.isBlank() || quantity <= 0 || unitPrice <= 0) {
                    continue;
                }
                rows.add(new InventoryRow(name, brand, quantity, unitPrice));
            }
            return rows;
        } catch (IOException ex) {
            throw new IllegalArgumentException("Unable to run OCR for receipt", ex);
        }
    }

    private static String stripMarkdownFence(String input) {
        String trimmed = input.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        }
        return trimmed.trim();
    }

    private static int parseQuantity(String value) {
        try {
            return Math.max(0, (int) Math.round(Double.parseDouble(value.replaceAll("[^0-9.]", ""))));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static double parsePrice(String value) {
        try {
            return Math.max(0, Double.parseDouble(value.replaceAll("[^0-9.]", "")));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static String sanitizeSeed(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    }

    private static Map<String, Object> step(String stage, String status, String message, Map<String, Object> details) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("stage", stage);
        payload.put("status", status);
        payload.put("message", message);
        payload.put("details", details);
        return payload;
    }

    private record InventoryRow(String name, String brand, int quantity, double unitPrice) {}
}
