package com.healthplus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.Statement;
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

        ReceiptExtraction extraction = extractRows(file, steps);
        if (extraction.rows().isEmpty()) {
            throw new IllegalArgumentException("No medicine rows were detected from receipt");
        }

        Map<String, Object> response = processExtractedRows(extraction, file.getOriginalFilename());
        steps.add(step("inventory-upsert", "success", "Rows inserted into medicines inventory", castMap(response.get("summary"))));
        response.put("steps", steps);
        return response;
    }

    public Map<String, Object> previewReceipt(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Receipt file is required");
        }

        List<Map<String, Object>> steps = new ArrayList<>();
        steps.add(step("validate-upload", "success", "Upload received for preview", Map.of(
                "file_name", file.getOriginalFilename() == null ? "unknown" : file.getOriginalFilename(),
                "content_type", file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
                "size_bytes", file.getSize()
        )));

        ReceiptExtraction extraction = extractRows(file, steps);
        if (extraction.rows().isEmpty()) {
            throw new IllegalArgumentException("No medicine rows were detected from receipt");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("mode", "preview");
        response.put("message", "Review extracted rows before applying inventory update");
        response.put("steps", steps);
        response.put("summary", Map.of("rows_detected", extraction.rows().size(), "source", extraction.source()));
        response.put("agency", Map.of(
                "name", extraction.agency().name(),
                "gstin", extraction.agency().gstin(),
                "phone", extraction.agency().phone(),
                "address", extraction.agency().address()
        ));
        response.put("bill", Map.of(
                "invoice_no", extraction.bill().invoiceNo(),
                "bill_number", extraction.bill().billNumber(),
                "invoice_date", extraction.bill().invoiceDate(),
                "bill_total", roundCurrency(extraction.bill().billTotal())
        ));
        response.put("rows", extraction.rows().stream().map(this::toEditableRow).toList());
        return response;
    }

    public Map<String, Object> applyReviewedReceipt(Map<String, Object> request) {
        Map<String, Object> agencyPayload = castMap(request.get("agency"));
        Map<String, Object> billPayload = castMap(request.get("bill"));
        List<Map<String, Object>> rowPayload = castListOfMaps(request.get("rows"));

        ReceiptAgency agency = new ReceiptAgency(
                asString(agencyPayload.get("name")),
                asString(agencyPayload.get("gstin")),
                asString(agencyPayload.get("phone")),
                asString(agencyPayload.get("address"))
        );
        ReceiptBill bill = new ReceiptBill(
                asString(billPayload.get("invoice_no")),
                asString(billPayload.get("bill_number")),
                asString(billPayload.get("invoice_date")),
                asDouble(billPayload.get("bill_total"))
        );

        List<InventoryRow> rows = new ArrayList<>();
        for (Map<String, Object> row : rowPayload) {
            InventoryRow parsed = new InventoryRow(
                    asString(row.get("product")),
                    asString(row.get("hsn")),
                    asString(row.get("mfr")),
                    asString(row.get("pack")),
                    asString(row.get("qty_fr")),
                    asInt(row.get("bonus")),
                    asString(row.get("batch")),
                    asString(row.get("exp")),
                    asDouble(row.get("mrp")),
                    asDouble(row.get("rate")),
                    asDouble(row.get("gst")),
                    asDouble(row.get("dis1")),
                    asDouble(row.get("dis2")),
                    asDouble(row.get("amount")),
                    asString(row.get("medicine_category")),
                    asString(row.get("medicine_type")),
                    asString(row.get("medicine_description")),
                    asString(row.get("medicine_uses")),
                    asString(row.get("medicine_doses"))
            );
            if (parsed.name().isBlank() || parsed.quantity() <= 0 || parsed.unitPrice() <= 0) {
                continue;
            }
            rows.add(parsed);
        }
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("No valid rows to apply");
        }

        return processExtractedRows(new ReceiptExtraction(agency, bill, rows, "reviewed"), "reviewed-entry");
    }

    private Map<String, Object> processExtractedRows(ReceiptExtraction extraction, String fileName) {
        Long agencyId = upsertAgency(extraction.agency());
        Long billId = upsertAgencyBill(agencyId, extraction.bill(), fileName, extraction.source());

        int inserted = 0;
        int updated = 0;
        List<Map<String, Object>> outcomes = new ArrayList<>();

        for (InventoryRow row : extraction.rows()) {
            MedicineUpsertResult medicineResult = upsertMedicine(row);
            if ("inserted".equals(medicineResult.action())) {
                inserted++;
            } else {
                updated++;
            }

            upsertInventoryDetail(medicineResult.medicineId(), row, billId);

            Map<String, Object> outcome = new LinkedHashMap<>();
            outcome.put("action", medicineResult.action());
            outcome.put("medicine_id", medicineResult.medicineId());
            outcome.put("agency_id", agencyId);
            outcome.put("agency_bill_id", billId);
            outcome.put("name", row.name());
            outcome.put("brand", row.brand());
            outcome.put("stock_added", row.stockQuantity());
            outcome.put("bonus", row.bonus());
            outcome.put("effective_unit_rate", row.effectiveUnitRate());
            outcome.put("effective_unit_price", row.effectiveUnitRate());
            outcome.put("batch", row.batch());
            outcome.put("expiry", row.expiry());
            outcomes.add(outcome);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("mode", "applied");
        response.put("message", "Receipt OCR processed and inventory updated");
        response.put("summary", Map.of("rows_detected", extraction.rows().size(), "inserted", inserted, "updated", updated));
        response.put("agency", Map.of(
                "id", agencyId,
                "name", extraction.agency().name(),
                "gstin", extraction.agency().gstin(),
                "phone", extraction.agency().phone(),
                "address", extraction.agency().address()
        ));
        response.put("bill", Map.of(
                "id", billId,
                "invoice_no", extraction.bill().invoiceNo(),
                "bill_number", extraction.bill().billNumber(),
                "invoice_date", extraction.bill().invoiceDate(),
                "bill_total", roundCurrency(extraction.bill().billTotal())
        ));
        response.put("rows", outcomes);
        return response;
    }

    private ReceiptExtraction extractRows(MultipartFile file, List<Map<String, Object>> steps) {
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        if (contentType.startsWith("text/") || fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
            List<InventoryRow> csvRows = extractFromCsv(file);
            steps.add(step("ocr-extraction", "success", "Parsed receipt rows from text/csv file", Map.of("rows", csvRows.size(), "source", "text")));
            String baseName = file.getOriginalFilename() == null ? "Unknown Agency" : file.getOriginalFilename().replaceAll("\\.[^.]+$", "");
            ReceiptAgency agency = new ReceiptAgency(baseName, "", "", "");
            return new ReceiptExtraction(agency, new ReceiptBill("", "", "", 0), csvRows, "text");
        }

        ReceiptExtraction aiRows = extractWithGemini(file);
        steps.add(step("ocr-extraction", "success", "OCR completed using Gemini vision model", Map.of("rows", aiRows.rows().size(), "source", "gemini")));
        return aiRows;
    }

    private Long upsertAgency(ReceiptAgency agency) {
        String normalizedName = agency.name() == null || agency.name().isBlank() ? "Unknown Agency" : agency.name().trim();
        String gstin = agency.gstin() == null ? "" : agency.gstin().trim();

        List<Long> existingByGstin = gstin.isBlank()
                ? List.of()
                : jdbcTemplate.query(
                "SELECT id FROM inventory_agencies WHERE lower(COALESCE(gstin, '')) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                gstin
        );
        if (!existingByGstin.isEmpty()) {
            Long id = existingByGstin.get(0);
            jdbcTemplate.update(
                    "UPDATE inventory_agencies SET name = ?, phone = COALESCE(NULLIF(?, ''), phone), address = COALESCE(NULLIF(?, ''), address), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    normalizedName,
                    agency.phone(),
                    agency.address(),
                    id
            );
            return id;
        }

        List<Long> existingByName = jdbcTemplate.query(
                "SELECT id FROM inventory_agencies WHERE lower(name) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                normalizedName
        );
        if (!existingByName.isEmpty()) {
            Long id = existingByName.get(0);
            jdbcTemplate.update(
                    "UPDATE inventory_agencies SET gstin = COALESCE(NULLIF(?, ''), gstin), phone = COALESCE(NULLIF(?, ''), phone), address = COALESCE(NULLIF(?, ''), address), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    gstin,
                    agency.phone(),
                    agency.address(),
                    id
            );
            return id;
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO inventory_agencies (name, gstin, phone, address) VALUES (?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, normalizedName);
            ps.setString(2, gstin);
            ps.setString(3, agency.phone() == null ? "" : agency.phone().trim());
            ps.setString(4, agency.address() == null ? "" : agency.address().trim());
            return ps;
        }, keyHolder);
        if (keyHolder.getKey() == null) {
            throw new IllegalStateException("Failed to create agency");
        }
        return keyHolder.getKey().longValue();
    }

    private Long upsertAgencyBill(Long agencyId, ReceiptBill bill, String fileName, String source) {
        String invoiceNo = bill.invoiceNo() == null ? "" : bill.invoiceNo().trim();
        String invoiceDate = bill.invoiceDate() == null ? "" : bill.invoiceDate().trim();

        if (!invoiceNo.isBlank()) {
            List<Long> existing = jdbcTemplate.query(
                    "SELECT id FROM agency_bills WHERE agency_id = ? AND lower(COALESCE(invoice_no, '')) = lower(?) AND lower(COALESCE(invoice_date, '')) = lower(?) LIMIT 1",
                    (rs, rowNum) -> rs.getLong("id"),
                    agencyId,
                    invoiceNo,
                    invoiceDate
            );
            if (!existing.isEmpty()) {
                return existing.get(0);
            }
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("source", source);
        metadata.put("invoice_no", invoiceNo);
        metadata.put("invoice_date", invoiceDate);
        metadata.put("bill_number", bill.billNumber());
        metadata.put("bill_total", roundCurrency(bill.billTotal()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO agency_bills (agency_id, invoice_no, bill_number, invoice_date, bill_total, file_name, raw_metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, agencyId);
            ps.setString(2, invoiceNo);
            ps.setString(3, bill.billNumber() == null ? "" : bill.billNumber().trim());
            ps.setString(4, invoiceDate);
            ps.setDouble(5, roundCurrency(bill.billTotal()));
            ps.setString(6, fileName == null ? "" : fileName.trim());
            ps.setString(7, objectMapper.valueToTree(metadata).toString());
            return ps;
        }, keyHolder);
        if (keyHolder.getKey() == null) {
            throw new IllegalStateException("Failed to create agency bill");
        }
        return keyHolder.getKey().longValue();
    }

    private MedicineUpsertResult upsertMedicine(InventoryRow row) {
        double resolvedMrp = roundCurrency(row.mrp() > 0 ? row.mrp() : row.unitPrice());
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
                    row.stockQuantity(),
                    roundCurrency(row.unitPrice()),
                    resolvedMrp,
                    resolvedMrp,
                    id
            );
            return new MedicineUpsertResult(id, "updated");
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO medicines (name, description, price, stock, category, brand, mrp, discount_percent, requires_prescription, rating, image_url, delivery_eta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, row.name());
            ps.setString(2, "Added from agency receipt OCR ingestion");
            ps.setDouble(3, roundCurrency(row.unitPrice()));
            ps.setInt(4, row.stockQuantity());
            ps.setString(5, "Inventory Intake");
            ps.setString(6, row.brand().isBlank() ? "Unspecified" : row.brand());
            ps.setDouble(7, resolvedMrp);
            ps.setInt(8, 0);
            ps.setInt(9, 0);
            ps.setDouble(10, 4.0);
            ps.setString(11, "https://picsum.photos/seed/" + sanitizeSeed(row.name()) + "/400/300");
            ps.setString(12, "Today");
            return ps;
        }, keyHolder);

        if (keyHolder.getKey() == null) {
            throw new IllegalStateException("Failed to insert medicine for inventory row: " + row.name());
        }
        return new MedicineUpsertResult(keyHolder.getKey().longValue(), "inserted");
    }

    private void upsertInventoryDetail(Long medicineId, InventoryRow row, Long agencyBillId) {
        jdbcTemplate.update(
                """
                INSERT INTO medicine_inventory_details
                (medicine_id, agency_bill_id, hsn, manufacturer, pack, qty_fr, batch, expiry, mrp, rate, dis1, dis2, amount, quantity_added, bonus, source,
                 medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ocr', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                medicineId,
                agencyBillId,
                row.hsn(),
                row.manufacturer(),
                row.pack(),
                row.qtyFr(),
                row.batch(),
                row.expiry(),
                roundCurrency(row.mrp()),
                roundCurrency(row.unitPrice()),
                roundCurrency(row.dis1()),
                roundCurrency(row.dis2()),
                roundCurrency(row.amount()),
                row.stockQuantity(),
                row.bonus(),
                row.medicineCategory(),
                row.medicineType(),
                row.medicineDescription(),
                row.medicineUses(),
                row.medicineDoses()
        );
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
                String product = parts[0].trim();
                String mfr = parts.length >= 4 ? parts[3].trim() : "";
                String qtyFr = parts[1].trim();
                double rate = parsePrice(parts[2]);
                InventoryRow row = new InventoryRow(product, "", mfr, "", qtyFr, 0, "", "", 0, rate, 0, 0, 0, 0, "", "", "", "", "");
                if (row.name().isBlank() || row.quantity() <= 0 || row.unitPrice() <= 0) {
                    continue;
                }
                rows.add(row);
            }
            return rows;
        } catch (IOException ex) {
            throw new IllegalArgumentException("Unable to parse receipt file");
        }
    }

    private ReceiptExtraction extractWithGemini(MultipartFile file) {
        //        String apiKey = System.getenv("GEMINI_API_KEY");
        String apiKey = "AIzaSyD4Z1usA7vSqJE-P4EolfqFLKSqAecVhcs";
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("GEMINI_API_KEY is required for OCR on image/pdf receipts. Use csv/txt upload or set key.");
        }

        try {
            byte[] bytes = file.getBytes();
            String encoded = Base64.getEncoder().encodeToString(bytes);
            String mimeType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();

            String prompt = "You are a medical billing specialist. You are extracting medicine inventory rows from a medical agency bill receipt. " +
                    "Use the table columns visible in the bill: Product, Hsn, Mfr, Pack, Qty+F/R, Batch, Exp, MRP, Rate, GST, Dis1, Dis2, Amount. " +
                    "Also extract agency and bill header details if visible. " +
                    "Return strict JSON only with this shape: {\"agency\":{\"name\":string,\"gstin\":string,\"phone\":string,\"address\":string},\"bill\":{\"invoice_no\":string,\"bill_number\":string,\"invoice_date\":string,\"bill_total\":number},\"items\":[{\"product\":string,\"hsn\":string,\"mfr\":string,\"pack\":string,\"qty_fr\":string,\"bonus\":number,\"batch\":string,\"exp\":string,\"mrp\":number,\"rate\":number,\"gst\":number,\"dis1\":number,\"dis2\":number,\"amount\":number,\"medicine_category\":string,\"medicine_type\":string,\"medicine_description\":string,\"medicine_uses\":string,\"medicine_doses\":string}]}. " +
                    "No markdown. Ignore subtotal/tax summary sections.";

            Map<String, Object> payload = Map.of(
                    "contents", List.of(Map.of("parts", List.of(
                            Map.of("text", prompt),
                            Map.of("inline_data", Map.of("mime_type", mimeType, "data", encoded))
                    )))
            );

            URL url = URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey).toURL();
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
            JsonNode agencyNode = extracted.path("agency");
            JsonNode billNode = extracted.path("bill");
            JsonNode items = extracted.path("items");
            if (!items.isArray()) {
                throw new IllegalArgumentException("Gemini OCR response missing items array");
            }

            ReceiptAgency agency = new ReceiptAgency(
                    textOf(agencyNode, "name", "agency_name", "seller_name"),
                    textOf(agencyNode, "gstin"),
                    textOf(agencyNode, "phone", "mobile", "contact"),
                    textOf(agencyNode, "address")
            );
            ReceiptBill bill = new ReceiptBill(
                    textOf(billNode, "invoice_no", "invoice_number"),
                    textOf(billNode, "bill_number", "bill_no"),
                    textOf(billNode, "invoice_date", "date"),
                    numberOf(billNode, "bill_total", "net_amount", "total")
            );

            List<InventoryRow> rows = new ArrayList<>();
            for (JsonNode item : items) {
                String product = textOf(item, "product", "name");
                String hsn = textOf(item, "hsn");
                String mfr = textOf(item, "mfr", "manufacturer", "brand");
                String pack = textOf(item, "pack");
                String qtyFr = textOf(item, "qty_fr", "qty_plus_fr", "quantity_fr");
                int bonus = parseQuantity(item.path("bonus").asText("0"));
                String batch = textOf(item, "batch");
                String exp = textOf(item, "exp", "expiry");
                double mrp = numberOf(item, "mrp");
                double rate = numberOf(item, "rate", "unit_price");
                double gst = numberOf(item, "gst", "gst_percent", "gst_percentage");
                double dis1 = numberOf(item, "dis1");
                double dis2 = numberOf(item, "dis2");
                double amount = numberOf(item, "amount");
                String medicineCategory = textOf(item, "medicine_category", "category");
                String medicineType = textOf(item, "medicine_type", "type");
                String medicineDescription = textOf(item, "medicine_description", "description");
                String medicineUses = textOf(item, "medicine_uses", "uses");
                String medicineDoses = textOf(item, "medicine_doses", "doses");

                int legacyQuantity = parseQuantity(item.path("quantity").asText("0"));
                if (qtyFr.isBlank() && legacyQuantity > 0) {
                    qtyFr = String.valueOf(legacyQuantity);
                }
                if (bonus <= 0) {
                    bonus = parseBonusFromQtyFr(qtyFr);
                }

                InventoryRow row = new InventoryRow(
                        product, hsn, mfr, pack, qtyFr, bonus, batch, exp, mrp, rate, gst, dis1, dis2, amount,
                        medicineCategory, medicineType, medicineDescription, medicineUses, medicineDoses
                );
                if (row.name().isBlank() || row.quantity() <= 0 || row.unitPrice() <= 0) {
                    continue;
                }
                rows.add(row);
            }
            return new ReceiptExtraction(agency, bill, rows, "gemini");
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

    private static int parseQtyFr(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        String primary = normalized;
        if (normalized.contains("+")) {
            primary = normalized.substring(0, normalized.indexOf('+'));
        } else if (normalized.contains("/")) {
            primary = normalized.substring(0, normalized.indexOf('/'));
        }
        return parseQuantity(primary);
    }

    private static int parseBonusFromQtyFr(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        String bonusPart = "";
        if (normalized.contains("+")) {
            bonusPart = normalized.substring(normalized.indexOf('+') + 1);
        } else if (normalized.contains("/")) {
            bonusPart = normalized.substring(normalized.indexOf('/') + 1);
        }
        return parseQuantity(bonusPart);
    }

    private static String textOf(JsonNode node, String... keys) {
        for (String key : keys) {
            String value = node.path(key).asText("");
            if (!value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private static double numberOf(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode valueNode = node.path(key);
            if (!valueNode.isMissingNode() && !valueNode.isNull()) {
                double value = parsePrice(valueNode.asText(""));
                if (value > 0) {
                    return value;
                }
            }
        }
        return 0;
    }

    private static String sanitizeSeed(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    }

    private static double roundCurrency(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static Map<String, Object> step(String stage, String status, String message, Map<String, Object> details) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("stage", stage);
        payload.put("status", status);
        payload.put("message", message);
        payload.put("details", details);
        return payload;
    }

    private Map<String, Object> toEditableRow(InventoryRow row) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("product", row.product());
        payload.put("hsn", row.hsn());
        payload.put("mfr", row.manufacturer());
        payload.put("pack", row.pack());
        payload.put("qty_fr", row.qtyFr());
        payload.put("bonus", row.bonus());
        payload.put("batch", row.batch());
        payload.put("exp", row.expiry());
        payload.put("mrp", roundCurrency(row.mrp()));
        payload.put("rate", roundCurrency(row.rate()));
        payload.put("gst", roundCurrency(row.gst()));
        payload.put("dis1", roundCurrency(row.dis1()));
        payload.put("dis2", roundCurrency(row.dis2()));
        payload.put("amount", roundCurrency(row.amount()));
        payload.put("medicine_category", row.medicineCategory());
        payload.put("medicine_type", row.medicineType());
        payload.put("medicine_description", row.medicineDescription());
        payload.put("medicine_uses", row.medicineUses());
        payload.put("medicine_doses", row.medicineDoses());
        return payload;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object value) {
        if (value instanceof Map<?, ?> mapValue) {
            Map<String, Object> parsed = new LinkedHashMap<>();
            mapValue.forEach((k, v) -> parsed.put(String.valueOf(k), v));
            return parsed;
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castListOfMaps(Object value) {
        if (!(value instanceof List<?> listValue)) {
            return List.of();
        }
        List<Map<String, Object>> parsed = new ArrayList<>();
        for (Object item : listValue) {
            parsed.add(castMap(item));
        }
        return parsed;
    }

    private static String asString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static int asInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(asString(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static double asDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(asString(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private record MedicineUpsertResult(Long medicineId, String action) {}
    private record ReceiptAgency(String name, String gstin, String phone, String address) {}
    private record ReceiptBill(String invoiceNo, String billNumber, String invoiceDate, double billTotal) {}
    private record ReceiptExtraction(ReceiptAgency agency, ReceiptBill bill, List<InventoryRow> rows, String source) {}

    private record InventoryRow(
            String product,
            String hsn,
            String manufacturer,
            String pack,
            String qtyFr,
            int bonus,
            String batch,
            String expiry,
            double mrp,
            double rate,
            double gst,
            double dis1,
            double dis2,
            double amount,
            String medicineCategory,
            String medicineType,
            String medicineDescription,
            String medicineUses,
            String medicineDoses
    ) {
        String name() {
            return product == null ? "" : product.trim();
        }

        String brand() {
            return manufacturer == null ? "" : manufacturer.trim();
        }

        int quantity() {
            int qty = parseQtyFr(qtyFr);
            if (qty > 0) {
                return qty;
            }
            if (amount > 0 && rate > 0) {
                return Math.max(1, (int) Math.round(amount / rate));
            }
            return 0;
        }

        int stockQuantity() {
            return quantity() + Math.max(0, bonus);
        }

        double effectiveUnitRate() {
            double baseRate = rate > 0 ? rate : mrp;
            if (baseRate <= 0) {
                return 0;
            }
            int paidQty = quantity();
            if (paidQty <= 0) {
                return 0;
            }
            int freeQty = Math.max(0, bonus);
            int equivalentQty = paidQty + freeQty;
            if (equivalentQty <= 0) {
                equivalentQty = paidQty;
            }
            double rateWithGst = baseRate;
            if (gst > 0) {
                rateWithGst = rateWithGst * (1 + (gst / 100.0));
            }
            double discountedRate = rateWithGst;
            if (dis1 > 0) {
                discountedRate = discountedRate * (1 - (dis1 / 100.0));
            }
            if (dis2 > 0) {
                discountedRate = discountedRate * (1 - (dis2 / 100.0));
            }
            double netCost = discountedRate * paidQty;
            return Math.max(0, netCost / equivalentQty);
        }

        double unitPrice() {
            return effectiveUnitRate();
        }

        public String medicineCategory() {
            return medicineCategory == null ? "" : medicineCategory.trim();
        }

        public String medicineType() {
            return medicineType == null ? "" : medicineType.trim();
        }

        public String medicineDescription() {
            return medicineDescription == null ? "" : medicineDescription.trim();
        }

        public String medicineUses() {
            return medicineUses == null ? "" : medicineUses.trim();
        }

        public String medicineDoses() {
            return medicineDoses == null ? "" : medicineDoses.trim();
        }
    }
}
