package com.healthplus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class InventoryReceiptOcrService {
    private static final String UNKNOWN_PROFILE_DESCRIPTION = "Added from agency receipt OCR ingestion";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final LocalReceiptOcrService localReceiptOcrService;
    private final TextractReceiptOcrService textractReceiptOcrService;
    private final GeminiReceiptOcrService geminiReceiptOcrService;
    private final GeminiReceiptValidationService geminiReceiptValidationService;
    private final GeminiReceiptPricingService geminiReceiptPricingService;
    private final boolean validationBlocking;


    public InventoryReceiptOcrService(JdbcTemplate jdbcTemplate,
                                      ObjectMapper objectMapper,
                                      LocalReceiptOcrService localReceiptOcrService,
                                      TextractReceiptOcrService textractReceiptOcrService,
                                      GeminiReceiptOcrService geminiReceiptOcrService,
                                      GeminiReceiptValidationService geminiReceiptValidationService,
                                      GeminiReceiptPricingService geminiReceiptPricingService,
                                      @Value("${app.ocr.validation.block:false}") boolean validationBlocking) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.localReceiptOcrService = localReceiptOcrService;
        this.textractReceiptOcrService = textractReceiptOcrService;
        this.geminiReceiptOcrService = geminiReceiptOcrService;
        this.geminiReceiptValidationService = geminiReceiptValidationService;
        this.geminiReceiptPricingService = geminiReceiptPricingService;
        this.validationBlocking = validationBlocking;
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

        String fileHash = sha256(file);
        steps.add(step("dedupe-check", "success", "Computed file hash for dedupe", Map.of("file_hash", fileHash)));

        ReceiptExtraction extraction = extractRows(file, fileHash, steps);
        cacheExtraction(fileHash,file,extraction);
        if (extraction.rows().isEmpty()) {
            throw new IllegalArgumentException("No medicine rows were detected from receipt");
        }



        Map<String, Object> response = new LinkedHashMap<>();
        response.put("mode", "preview");
        response.put("message", "Review extracted rows before applying inventory update");
        response.put("steps", steps);
        response.put("summary", Map.of(
                "rows_detected", extraction.rows().size(),
                "source", extraction.source()
        ));
        response.put("extraction_meta", extraction.extractionMeta());
        response.put("agency", Map.of(
                "name", extraction.agency().name(),
                "gstin", extraction.agency().gstin(),
                "dl_no", extraction.agency().dlNo(),
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
                asString(agencyPayload.get("dl_no")),
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
        List<String> packMissingRows = new ArrayList<>();
        for (int i = 0; i < rowPayload.size(); i++) {
            Map<String, Object> row = rowPayload.get(i);
            String qtyFr = asString(row.get("qty_fr"));
            String bonusText = asString(row.get("bonus"));
            String product = asString(row.get("product"));
            String pack = asString(row.get("pack"));
            if (pack.isBlank()) {
                String rowLabel = "#" + (i + 1);
                if (!product.isBlank()) {
                    rowLabel += " (" + product + ")";
                }
                packMissingRows.add(rowLabel);
            }
            int quantityAdded = asInt(row.get("quantity_added"));
            int bonusQty = asInt(row.get("bonus_qty"));
            if (quantityAdded <= 0) {
                quantityAdded = ReceiptOcrUtils.parseQtyFr(qtyFr);
            }
            if (bonusQty <= 0) {
                bonusQty = ReceiptOcrUtils.parseBonusFromQtyFr(qtyFr);
            }
            double mrp = asDouble(row.get("mrp"));
            double rate = asDouble(row.get("rate"));
            double gst = asDouble(row.get("gst"));
            double dis1 = asDouble(row.get("dis1"));
            double dis2 = asDouble(row.get("dis2"));
            double amount = asDouble(row.get("amount"));
            String deal = asString(row.get("deal"));
            double effectiveCostPrice = asDouble(row.get("effective_cost_price"));
            if (effectiveCostPrice <= 0) {
                effectiveCostPrice = ReceiptOcrUtils.computeEffectiveCostPrice(
                        rate,
                        mrp,
                        gst,
                        dis1,
                        dis2,
                        qtyFr,
                        bonusText,
                        deal,
                        quantityAdded,
                        bonusQty
                );
            }
            InventoryRow parsed = new InventoryRow(
                    product,
                    asString(row.get("hsn")),
                    asString(row.get("mfr")),
                    pack,
                    qtyFr,
                    bonusText,
                    quantityAdded,
                    bonusQty,
                    asString(row.get("batch")),
                    asString(row.get("exp")),
                    mrp,
                    rate,
                    gst,
                    dis1,
                    dis2,
                    amount,
                    deal,
                    effectiveCostPrice,
                    asString(row.get("medicine_category")),
                    asString(row.get("medicine_type")),
                    asString(row.get("medicine_description")),
                    asString(row.get("medicine_uses")),
                    asString(row.get("medicine_doses"))
            );
            if (parsed.name().isBlank() || parsed.quantity() <= 0 || !parsed.hasPricingEvidence()) {
                continue;
            }
            rows.add(parsed);
        }
        if (!packMissingRows.isEmpty()) {
            throw new IllegalArgumentException("Pack is required. Please add pack for row(s): " + String.join(", ", packMissingRows));
        }
        rows = rows.stream()
                .filter(row -> !row.name().isBlank() && row.quantity() > 0 && row.effectiveCostPrice() > 0)
                .toList();
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("No valid rows to apply");
        }

        return processExtractedRows(
                new ReceiptExtraction(agency, bill, rows, "reviewed", Map.of("strategy", "manual-review", "gemini_calls", 0, "cache_hit", false)),
                "reviewed-entry"
        );
    }

    private Map<String, Object> processExtractedRows(ReceiptExtraction extraction, String fileName) {
        Long agencyId = upsertAgency(extraction.agency());
        Long billId = upsertAgencyBill(agencyId, extraction.bill(), fileName, extraction.source());

        int inserted = 0;
        int updated = 0;
        int ambiguousRows = 0;
        List<Map<String, Object>> outcomes = new ArrayList<>();
        Map<String, MedicineProfileResolution> profileCache = new LinkedHashMap<>();
        ProcessingStats processingStats = new ProcessingStats();

        for (InventoryRow row : extraction.rows()) {
            int paidQty = row.quantityAdded();
            if (paidQty <= 0) {
                paidQty = row.quantity();
            }
            int bonusQty = row.bonusQty();
            int paidUnits = ReceiptOcrUtils.toSmallestUnits(paidQty, row.pack());
            int bonusUnits = ReceiptOcrUtils.toSmallestUnits(bonusQty, row.pack());
            String profileCacheKey = (row.name() + "|" + row.brand()).toLowerCase(Locale.ROOT);
            MedicineProfileResolution profileResolution = profileCache.computeIfAbsent(profileCacheKey, key -> resolveMedicineProfile(row, processingStats));
            if (profileResolution == null || profileResolution.profile() == null) {
                processingStats.unknownFallbacks++;
                MedicineProfile fallback = MedicineProfile.unknown("fallback");
                profileResolution = new MedicineProfileResolution(fallback, "fallback", 0.1);
                profileCache.put(profileCacheKey, profileResolution);
            }
            MedicineUpsertResult medicineResult = upsertMedicine(row, profileResolution.profile());
            if ("inserted".equals(medicineResult.action())) {
                inserted++;
            } else {
                updated++;
            }

            upsertInventoryDetail(medicineResult.medicineId(), row, billId, profileResolution.profile());

            Map<String, Object> outcome = new LinkedHashMap<>();
            String bonusTextValue = bonusTextValue(row);
            outcome.put("action", medicineResult.action());
            outcome.put("medicine_id", medicineResult.medicineId());
            outcome.put("agency_id", agencyId);
            outcome.put("agency_bill_id", billId);
            outcome.put("name", row.name());
            outcome.put("brand", row.brand());
            outcome.put("stock_added", paidUnits + bonusUnits);
            outcome.put("bonus", bonusTextValue);
            outcome.put("bonus_qty", bonusUnits);
            outcome.put("effective_unit_rate", row.effectiveCostPrice());
            outcome.put("effective_unit_price", row.effectiveCostPrice());
            outcome.put("effective_cost_price", row.effectiveCostPrice());
            outcome.put("deal", row.deal());
            outcome.put("batch", row.batch());
            outcome.put("expiry", row.expiry());
            outcome.put("medicine_profile_source", profileResolution.source());
            outcomes.add(outcome);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("mode", "applied");
        response.put("message", "Receipt OCR processed and inventory updated");
        response.put("summary", Map.of(
                "rows_detected", extraction.rows().size(),
                "inserted", inserted,
                "updated", updated,
                "ambiguous_rows", ambiguousRows
        ));
        response.put("agency", Map.of(
                "id", agencyId,
                "name", extraction.agency().name(),
                "gstin", extraction.agency().gstin(),
                "dl_no", extraction.agency().dlNo(),
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
        response.put("extraction_meta", extraction.extractionMeta());
        response.put("ambiguity", Map.of(
                "rows_with_flags", ambiguousRows,
                "fuzzy_profile_matches", processingStats.fuzzyProfileMatches,
                "gemini_profile_calls", processingStats.geminiProfileCalls,
                "profile_cache_hits", processingStats.profileCacheHits,
                "profile_db_hits", processingStats.profileDbHits,
                "profile_unknown_fallbacks", processingStats.unknownFallbacks
        ));
        return response;
    }

    private ReceiptExtraction extractRows(MultipartFile file, String fileHash, List<Map<String, Object>> steps) {
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        if (contentType.startsWith("text/") || fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
            List<InventoryRow> csvRows = extractFromCsv(file);
            steps.add(step("ocr-extraction", "success", "Parsed receipt rows from text/csv file", Map.of("rows", csvRows.size(), "source", "text")));
            String baseName = file.getOriginalFilename() == null ? "Unknown Agency" : file.getOriginalFilename().replaceAll("\\.[^.]+$", "");
            ReceiptAgency agency = new ReceiptAgency(baseName, "", "", "", "");
            return new ReceiptExtraction(
                    agency,
                    new ReceiptBill("", "", "", 0),
                    csvRows,
                    "text",
                    Map.of("strategy", "local-text-parser", "gemini_calls", 0, "cache_hit", false)
            );
        }

        ReceiptExtraction cached = fetchCachedExtraction(fileHash);
        if (cached != null && !cached.rows().isEmpty()) {
            steps.add(step("ocr-extraction", "success", "Used cached OCR extraction (Gemini skipped)", Map.of("rows", cached.rows().size(), "source", cached.source())));
            return cached;
        }
        ReceiptExtraction aiRows = geminiReceiptOcrService.extract(file);
        steps.add(step("ocr-extraction", "success", "OCR completed using Gemini vision model", Map.of("rows", aiRows.rows().size(), "source", "gemini")));
        return aiRows;
    }

    private Long upsertAgency(ReceiptAgency agency) {
        String normalizedName = agency.name() == null || agency.name().isBlank() ? "Unknown Agency" : agency.name().trim();
        String gstin = agency.gstin() == null ? "" : agency.gstin().trim();
        String dlNo = agency.dlNo() == null ? "" : agency.dlNo().trim();

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
                    "UPDATE inventory_agencies SET name = ?, dl_no = COALESCE(NULLIF(?, ''), dl_no), phone = COALESCE(NULLIF(?, ''), phone), address = COALESCE(NULLIF(?, ''), address), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    normalizedName,
                    dlNo,
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
                    "UPDATE inventory_agencies SET gstin = COALESCE(NULLIF(?, ''), gstin), dl_no = COALESCE(NULLIF(?, ''), dl_no), phone = COALESCE(NULLIF(?, ''), phone), address = COALESCE(NULLIF(?, ''), address), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    gstin,
                    dlNo,
                    agency.phone(),
                    agency.address(),
                    id
            );
            return id;
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO inventory_agencies (name, gstin, dl_no, phone, address) VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, normalizedName);
            ps.setString(2, gstin);
            ps.setString(3, dlNo);
            ps.setString(4, agency.phone() == null ? "" : agency.phone().trim());
            ps.setString(5, agency.address() == null ? "" : agency.address().trim());
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

    private MedicineUpsertResult upsertMedicine(InventoryRow row, MedicineProfile profile) {
        double resolvedMrp = roundCurrency(row.mrp() > 0 ? row.mrp() : row.effectiveCostPrice());
        List<Long> existingIds = jdbcTemplate.query(
                "SELECT id FROM medicines WHERE lower(name) = lower(?) AND lower(COALESCE(brand, '')) = lower(?) LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                row.name(),
                row.brand()
        );

        if (!existingIds.isEmpty()) {
            Long id = existingIds.get(0);
            int paidQty = row.quantityAdded();
            if (paidQty <= 0) {
                paidQty = row.quantity();
            }
            int bonusQty = row.bonusQty();
            int stockUnitsToAdd = ReceiptOcrUtils.toSmallestUnits(paidQty, row.pack()) + ReceiptOcrUtils.toSmallestUnits(bonusQty, row.pack());
            jdbcTemplate.update(
                    """
                    UPDATE medicines
                    SET stock = stock + ?,
                        price = ?,
                        mrp = CASE WHEN mrp IS NULL OR mrp < ? THEN ? ELSE mrp END,
                        category = CASE WHEN category IS NULL OR TRIM(category) = '' OR lower(TRIM(category)) = 'unknown' OR lower(TRIM(category)) = 'inventory intake' THEN ? ELSE category END,
                        description = CASE WHEN description IS NULL OR TRIM(description) = '' OR lower(TRIM(description)) = 'unknown' OR lower(TRIM(description)) = 'added from agency receipt ocr ingestion' THEN ? ELSE description END,
                        medicine_type = CASE WHEN medicine_type IS NULL OR TRIM(medicine_type) = '' OR lower(TRIM(medicine_type)) = 'unknown' THEN ? ELSE medicine_type END,
                        medicine_uses = CASE WHEN medicine_uses IS NULL OR TRIM(medicine_uses) = '' OR lower(TRIM(medicine_uses)) = 'unknown' THEN ? ELSE medicine_uses END,
                        medicine_doses = CASE WHEN medicine_doses IS NULL OR TRIM(medicine_doses) = '' OR lower(TRIM(medicine_doses)) = 'unknown' THEN ? ELSE medicine_doses END
                    WHERE id = ?
                    """,
                    stockUnitsToAdd,
                    roundCurrency(row.effectiveCostPrice()),
                    resolvedMrp,
                    resolvedMrp,
                    profile.category(),
                    profile.description(),
                    profile.type(),
                    profile.uses(),
                    profile.doses(),
                    id
            );
            return new MedicineUpsertResult(id, "updated");
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO medicines (name, description, price, stock, category, brand, mrp, discount_percent, requires_prescription, rating, image_url, delivery_eta, medicine_type, medicine_uses, medicine_doses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, row.name());
            ps.setString(2, profile.description());
            ps.setDouble(3, roundCurrency(row.effectiveCostPrice()));
            int paidQty = row.quantityAdded();
            if (paidQty <= 0) {
                paidQty = row.quantity();
            }
            int bonusQty = row.bonusQty();
            int stockUnitsToAdd = ReceiptOcrUtils.toSmallestUnits(paidQty, row.pack()) + ReceiptOcrUtils.toSmallestUnits(bonusQty, row.pack());
            ps.setInt(4, stockUnitsToAdd);
            ps.setString(5, profile.category());
            ps.setString(6, row.brand().isBlank() ? "Unspecified" : row.brand());
            ps.setDouble(7, resolvedMrp);
            ps.setInt(8, 0);
            ps.setInt(9, 0);
            ps.setDouble(10, 4.0);
            ps.setString(11, "https://picsum.photos/seed/" + sanitizeSeed(row.name()) + "/400/300");
            ps.setString(12, "Today");
            ps.setString(13, profile.type());
            ps.setString(14, profile.uses());
            ps.setString(15, profile.doses());
            return ps;
        }, keyHolder);

        if (keyHolder.getKey() == null) {
            throw new IllegalStateException("Failed to insert medicine for inventory row: " + row.name());
        }
        return new MedicineUpsertResult(keyHolder.getKey().longValue(), "inserted");
    }

    private void upsertInventoryDetail(Long medicineId, InventoryRow row, Long agencyBillId, MedicineProfile profile) {
        double storedRate = row.rate();
        if (storedRate <= 0) {
            storedRate = row.mrp();
        }
        int paidQty = row.quantityAdded();
        if (paidQty <= 0) {
            paidQty = row.quantity();
        }
        int bonusQty = row.bonusQty();
        int paidUnits = ReceiptOcrUtils.toSmallestUnits(paidQty, row.pack());
        int bonusUnits = ReceiptOcrUtils.toSmallestUnits(bonusQty, row.pack());
        String bonusTextValue = bonusTextValue(row);
        String resolvedName = row.name();
        String resolvedBrand = row.brand().isBlank() ? "Unspecified" : row.brand();
        jdbcTemplate.update(
                """
                INSERT INTO medicine_inventory_details
                (medicine_id, medicine_name, brand, agency_bill_id, hsn, manufacturer, pack, qty_fr, batch, expiry, mrp, rate, gst, dis1, dis2, amount, deal, effective_cost_price, quantity_added, bonus_qty, bonus, source,
                 medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ocr', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                medicineId,
                resolvedName,
                resolvedBrand,
                agencyBillId,
                row.hsn(),
                row.manufacturer(),
                row.pack(),
                row.qtyFr(),
                row.batch(),
                row.expiry(),
                roundCurrency(row.mrp()),
                roundCurrency(storedRate),
                roundCurrency(row.gst()),
                roundCurrency(row.dis1()),
                roundCurrency(row.dis2()),
                roundCurrency(row.amount()),
                row.deal(),
                roundCurrency(row.effectiveCostPrice()),
                paidUnits,
                bonusUnits,
                bonusTextValue,
                profile.category(),
                profile.type(),
                profile.description(),
                profile.uses(),
                profile.doses()
        );
    }

    private MedicineProfileResolution resolveMedicineProfile(InventoryRow row, ProcessingStats stats) {
        MedicineProfileResolution medicineProfileResolution = null;
        MedicineProfile fromRow = normalizeMedicineProfile(new MedicineProfile(
                row.medicineCategory(),
                row.medicineType(),
                row.medicineDescription(),
                row.medicineUses(),
                row.medicineDoses(),
                "reviewed"
        ));
        if (fromRow.isComplete()) {
            medicineProfileResolution =  new MedicineProfileResolution(fromRow, "reviewed", 1.0);
        }

        MedicineProfile fromCache = fetchMedicineProfileFromCache(row, stats);
        MedicineProfile mergedFromCache = fromRow.mergeMissing(fromCache);
        if (mergedFromCache.isComplete()) {
            medicineProfileResolution =  new MedicineProfileResolution(mergedFromCache, fromCache.source(), 0.95);
        }

        MedicineProfile fromDatabase = fetchMedicineProfileFromDatabase(row, stats);
        MedicineProfile merged = fromRow.mergeMissing(fromDatabase);
        if (merged.isComplete()) {
            medicineProfileResolution =  new MedicineProfileResolution(merged, fromDatabase.source(), 0.9);
        }
        return medicineProfileResolution;
//      TODO call gemini to gather medicine details
//        if (!shouldCallGeminiForProfile(row)) {
//            stats.unknownFallbacks++;
//            MedicineProfile fallback = merged.mergeMissing(MedicineProfile.unknown("fallback"));
//            return new MedicineProfileResolution(fallback, "fallback", 0.2);
//        }
//        GeminiReceiptOcrService.GeminiProfileResult geminiResult = geminiReceiptOcrService.inferMedicineProfile(row);
//        if (geminiResult.called()) {
//            stats.geminiProfileCalls++;
//        }
//        MedicineProfile fromGemini = normalizeMedicineProfile(geminiResult.profile());
//        MedicineProfile resolved = merged.mergeMissing(fromGemini);
//        upsertMedicineProfileCache(row, resolved, fromGemini.source(), resolved.isComplete() ? 0.85 : 0.35);
//        return new MedicineProfileResolution(resolved, fromGemini.source(), resolved.isComplete() ? 0.85 : 0.35);
    }

    private MedicineProfile fetchMedicineProfileFromDatabase(InventoryRow row, ProcessingStats stats) {
        List<MedicineProfile> profiles = jdbcTemplate.query(
                """
                SELECT category,
                       medicine_type,
                       description,
                       medicine_uses,
                       medicine_doses
                FROM medicines
                WHERE lower(name) = lower(?)
                  AND lower(COALESCE(brand, '')) = lower(?)
                LIMIT 1
                """,
                (rs, rowNum) -> normalizeMedicineProfile(new MedicineProfile(
                        rs.getString("category"),
                        rs.getString("medicine_type"),
                        rs.getString("description"),
                        rs.getString("medicine_uses"),
                        rs.getString("medicine_doses"),
                        "database"
                )),
                row.name(),
                row.brand()
        );
        if (profiles.isEmpty()) {
            List<MedicineProfile> fuzzyProfiles = jdbcTemplate.query(
                    """
                    SELECT category,
                           medicine_type,
                           description,
                           medicine_uses,
                           medicine_doses
                    FROM medicines
                    WHERE lower(replace(name, ' ', '')) = lower(replace(?, ' ', ''))
                    ORDER BY CASE WHEN lower(COALESCE(brand, '')) = lower(?) THEN 0 ELSE 1 END, id DESC
                    LIMIT 1
                    """,
                    (rs, rowNum) -> normalizeMedicineProfile(new MedicineProfile(
                            rs.getString("category"),
                            rs.getString("medicine_type"),
                            rs.getString("description"),
                            rs.getString("medicine_uses"),
                            rs.getString("medicine_doses"),
                            "database-fuzzy"
                    )),
                    row.name(),
                    row.brand()
            );
            if (fuzzyProfiles.isEmpty()) {
                return MedicineProfile.unknown("database");
            }
            stats.fuzzyProfileMatches++;
            stats.profileDbHits++;
            return fuzzyProfiles.get(0);
        }
        stats.profileDbHits++;
        return profiles.get(0);
    }

    private MedicineProfile fetchMedicineProfileFromCache(InventoryRow row, ProcessingStats stats) {
        List<MedicineProfile> exact = jdbcTemplate.query(
                """
                SELECT medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses, source
                FROM medicine_profile_cache
                WHERE cache_key = ?
                LIMIT 1
                """,
                (rs, rowNum) -> normalizeMedicineProfile(new MedicineProfile(
                        rs.getString("medicine_category"),
                        rs.getString("medicine_type"),
                        rs.getString("medicine_description"),
                        rs.getString("medicine_uses"),
                        rs.getString("medicine_doses"),
                        rs.getString("source")
                )),
                profileCacheKey(row)
        );
        if (!exact.isEmpty()) {
            stats.profileCacheHits++;
            return exact.get(0);
        }

        List<MedicineProfile> fuzzy = jdbcTemplate.query(
                """
                SELECT medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses, source
                FROM medicine_profile_cache
                WHERE lower(replace(product_name, ' ', '')) = lower(replace(?, ' ', ''))
                ORDER BY CASE WHEN lower(COALESCE(manufacturer, '')) = lower(?) THEN 0 ELSE 1 END, updated_at DESC
                LIMIT 1
                """,
                (rs, rowNum) -> normalizeMedicineProfile(new MedicineProfile(
                        rs.getString("medicine_category"),
                        rs.getString("medicine_type"),
                        rs.getString("medicine_description"),
                        rs.getString("medicine_uses"),
                        rs.getString("medicine_doses"),
                        rs.getString("source")
                )),
                row.name(),
                row.brand()
        );
        if (!fuzzy.isEmpty()) {
            stats.profileCacheHits++;
            stats.fuzzyProfileMatches++;
            return fuzzy.get(0);
        }

        return MedicineProfile.unknown("profile-cache");
    }

    private void upsertMedicineProfileCache(InventoryRow row, MedicineProfile profile, String source, double confidence) {
        jdbcTemplate.update(
                """
                INSERT INTO medicine_profile_cache
                (cache_key, product_name, manufacturer, pack, medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses, source, confidence, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(cache_key) DO UPDATE SET
                  medicine_category = excluded.medicine_category,
                  medicine_type = excluded.medicine_type,
                  medicine_description = excluded.medicine_description,
                  medicine_uses = excluded.medicine_uses,
                  medicine_doses = excluded.medicine_doses,
                  source = excluded.source,
                  confidence = excluded.confidence,
                  updated_at = CURRENT_TIMESTAMP
                """,
                profileCacheKey(row),
                row.name(),
                row.brand(),
                row.pack(),
                profile.category(),
                profile.type(),
                profile.description(),
                profile.uses(),
                profile.doses(),
                source,
                confidence
        );
    }

    private boolean shouldCallGeminiForProfile(InventoryRow row) {
        String name = row.name();
        if (name.isBlank()) {
            return false;
        }
        String normalized = name.toLowerCase(Locale.ROOT);
        if (normalized.length() < 4) {
            return false;
        }
        return normalized.chars().anyMatch(Character::isLetter);
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
                double rate = ReceiptOcrUtils.parsePrice(parts[2]);
                String bonusText = ReceiptOcrUtils.normalizeBonusText("", qtyFr);
                int quantityAdded = ReceiptOcrUtils.parseQtyFr(qtyFr);
                int bonusQty = ReceiptOcrUtils.parseBonusFromQtyFr(qtyFr);
                double effectiveCostPrice = ReceiptOcrUtils.computeEffectiveCostPrice(
                        rate,
                        0,
                        0,
                        0,
                        0,
                        qtyFr,
                        bonusText,
                        "",
                        quantityAdded,
                        bonusQty
                );
                InventoryRow row = new InventoryRow(product, "", mfr, "", qtyFr, bonusText, quantityAdded, bonusQty, "", "", 0, rate, 0, 0, 0, 0, "", effectiveCostPrice, "", "", "", "", "");
                if (row.name().isBlank() || row.quantity() <= 0 || !row.hasPricingEvidence()) {
                    continue;
                }
                rows.add(row);
            }
            return rows;
        } catch (IOException ex) {
            throw new IllegalArgumentException("Unable to parse receipt file");
        }
    }
    private ReceiptExtraction fetchCachedExtraction(String fileHash) {
        List<String> rows = jdbcTemplate.query(
                "SELECT extracted_json FROM ocr_receipt_cache WHERE file_hash = ? LIMIT 1",
                (rs, rowNum) -> rs.getString("extracted_json"),
                fileHash
        );
        if (rows.isEmpty()) {
            return null;
        }
        try {
            JsonNode extracted = objectMapper.readTree(rows.get(0));
            ReceiptAgency agency = new ReceiptAgency(
                    ReceiptOcrJsonSupport.textOf(extracted.path("agency"), "name"),
                    ReceiptOcrJsonSupport.textOf(extracted.path("agency"), "gstin"),
                    ReceiptOcrJsonSupport.textOf(extracted.path("agency"), "dl_no", "dl", "dlno"),
                    ReceiptOcrJsonSupport.textOf(extracted.path("agency"), "phone"),
                    ReceiptOcrJsonSupport.textOf(extracted.path("agency"), "address")
            );
            ReceiptBill bill = new ReceiptBill(
                    ReceiptOcrJsonSupport.textOf(extracted.path("bill"), "invoice_no"),
                    ReceiptOcrJsonSupport.textOf(extracted.path("bill"), "bill_number"),
                    ReceiptOcrJsonSupport.textOf(extracted.path("bill"), "invoice_date"),
                    ReceiptOcrJsonSupport.numberOf(extracted.path("bill"), "bill_total")
            );
            List<InventoryRow> parsedRows = ReceiptOcrJsonSupport.parseItems(extracted.path("items"));
            if (parsedRows.isEmpty()) {
                return null;
            }
            cleanupExistingBillFromCache(agency, bill);
            jdbcTemplate.update("UPDATE ocr_receipt_cache SET last_used_at = CURRENT_TIMESTAMP WHERE file_hash = ?", fileHash);
            return new ReceiptExtraction(
                    agency,
                    bill,
                    parsedRows,
                    "cache",
                    Map.of("strategy", "receipt-cache", "gemini_calls", 0, "cache_hit", true)
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private void cleanupExistingBillFromCache(ReceiptAgency agency, ReceiptBill bill) {
        if (agency == null || bill == null) {
            return;
        }
        String gstin = agency.gstin() == null ? "" : agency.gstin().trim();
        String agencyName = agency.name() == null ? "" : agency.name().trim();
        String invoiceNo = bill.invoiceNo() == null ? "" : bill.invoiceNo().trim();
        String billNumber = bill.billNumber() == null ? "" : bill.billNumber().trim();
        String invoiceDate = bill.invoiceDate() == null ? "" : bill.invoiceDate().trim();

        Long agencyId = null;
        if (!gstin.isBlank()) {
            List<Long> agencyIds = jdbcTemplate.query(
                    "SELECT id FROM inventory_agencies WHERE lower(COALESCE(gstin, '')) = lower(?) LIMIT 1",
                    (rs, rowNum) -> rs.getLong("id"),
                    gstin
            );
            if (!agencyIds.isEmpty()) {
                agencyId = agencyIds.get(0);
            }
        }
        if (agencyId == null && !agencyName.isBlank()) {
            List<Long> agencyIds = jdbcTemplate.query(
                    "SELECT id FROM inventory_agencies WHERE lower(name) = lower(?) LIMIT 1",
                    (rs, rowNum) -> rs.getLong("id"),
                    agencyName
            );
            if (!agencyIds.isEmpty()) {
                agencyId = agencyIds.get(0);
            }
        }
        if (agencyId == null) {
            return;
        }

        Long billId = null;
        if (!invoiceNo.isBlank()) {
            List<Long> billIds = jdbcTemplate.query(
                    "SELECT id FROM agency_bills WHERE agency_id = ? AND lower(COALESCE(invoice_no, '')) = lower(?) AND (? = '' OR lower(COALESCE(invoice_date, '')) = lower(?)) LIMIT 1",
                    (rs, rowNum) -> rs.getLong("id"),
                    agencyId,
                    invoiceNo,
                    invoiceDate,
                    invoiceDate
            );
            if (!billIds.isEmpty()) {
                billId = billIds.get(0);
            }
        } else if (!billNumber.isBlank()) {
            List<Long> billIds = jdbcTemplate.query(
                    "SELECT id FROM agency_bills WHERE agency_id = ? AND lower(COALESCE(bill_number, '')) = lower(?) AND (? = '' OR lower(COALESCE(invoice_date, '')) = lower(?)) LIMIT 1",
                    (rs, rowNum) -> rs.getLong("id"),
                    agencyId,
                    billNumber,
                    invoiceDate,
                    invoiceDate
            );
            if (!billIds.isEmpty()) {
                billId = billIds.get(0);
            }
        }
        if (billId == null) {
            return;
        }

        List<Map<String, Object>> detailRows = jdbcTemplate.queryForList(
                "SELECT medicine_id, COALESCE(quantity_added, 0) AS quantity_added, COALESCE(bonus_qty, 0) AS bonus_qty FROM medicine_inventory_details WHERE agency_bill_id = ?",
                billId
        );
        Map<Long, Integer> unitsByMedicine = new LinkedHashMap<>();
        for (Map<String, Object> row : detailRows) {
            if (!(row.get("medicine_id") instanceof Number medId)) {
                continue;
            }
            int qty = row.get("quantity_added") instanceof Number qtyNum ? qtyNum.intValue() : 0;
            int bonus = row.get("bonus_qty") instanceof Number bonusNum ? bonusNum.intValue() : 0;
            int totalUnits = Math.max(0, qty) + Math.max(0, bonus);
            if (totalUnits <= 0) {
                continue;
            }
            long medicineId = medId.longValue();
            unitsByMedicine.put(medicineId, unitsByMedicine.getOrDefault(medicineId, 0) + totalUnits);
        }
        for (Map.Entry<Long, Integer> entry : unitsByMedicine.entrySet()) {
            int qty = entry.getValue();
            jdbcTemplate.update(
                    "UPDATE medicines SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END WHERE id = ?",
                    qty,
                    qty,
                    entry.getKey()
            );
        }
        jdbcTemplate.update("DELETE FROM medicine_inventory_details WHERE agency_bill_id = ?", billId);
    }

    private void cacheExtraction(String fileHash, MultipartFile file, ReceiptExtraction extraction) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("agency", Map.of(
                "name", extraction.agency().name(),
                "gstin", extraction.agency().gstin(),
                "dl_no", extraction.agency().dlNo(),
                "phone", extraction.agency().phone(),
                "address", extraction.agency().address()
        ));
        payload.put("bill", Map.of(
                "invoice_no", extraction.bill().invoiceNo(),
                "bill_number", extraction.bill().billNumber(),
                "invoice_date", extraction.bill().invoiceDate(),
                "bill_total", roundCurrency(extraction.bill().billTotal())
        ));
        payload.put("items", extraction.rows().stream().map(this::toEditableRow).toList());

        jdbcTemplate.update(
                """
                INSERT INTO ocr_receipt_cache (file_hash, file_name, content_type, extracted_json, extraction_source, last_used_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(file_hash) DO UPDATE SET
                  extracted_json = excluded.extracted_json,
                  extraction_source = excluded.extraction_source,
                  content_type = excluded.content_type,
                  file_name = excluded.file_name,
                  last_used_at = CURRENT_TIMESTAMP
                """,
                fileHash,
                file.getOriginalFilename() == null ? "" : file.getOriginalFilename(),
                file.getContentType() == null ? "" : file.getContentType(),
                objectMapper.valueToTree(payload).toString(),
                extraction.source()
        );
    }
    private static MedicineProfile normalizeMedicineProfile(MedicineProfile profile) {
        return new MedicineProfile(
                normalizeProfileValue(profile.category(), "Inventory Intake"),
                normalizeProfileValue(profile.type(), "unknown"),
                normalizeProfileValue(profile.description(), UNKNOWN_PROFILE_DESCRIPTION),
                normalizeProfileValue(profile.uses(), "unknown"),
                normalizeProfileValue(profile.doses(), "unknown"),
                profile.source()
        );
    }

    private static String normalizeProfileValue(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        if (trimmed.isBlank()) {
            return fallback;
        }
        if ("null".equalsIgnoreCase(trimmed) || "n/a".equalsIgnoreCase(trimmed)) {
            return fallback;
        }
        return trimmed;
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
        String bonusTextValue = bonusTextValue(row);
        int bonusQty = row.bonusQty();
        int paidQty = row.quantityAdded();
        if (paidQty <= 0) {
            paidQty = row.quantity();
        }
        payload.put("product", row.product());
        payload.put("hsn", row.hsn());
        payload.put("mfr", row.manufacturer());
        payload.put("pack", row.pack());
        payload.put("qty_fr", row.qtyFr());
        payload.put("bonus", bonusTextValue);
        payload.put("bonus_qty", bonusQty);
        payload.put("quantity_added", paidQty);
        payload.put("batch", row.batch());
        payload.put("exp", row.expiry());
        payload.put("mrp", roundCurrency(row.mrp()));
        payload.put("rate", roundCurrency(row.rate()));
        payload.put("gst", roundCurrency(row.gst()));
        payload.put("dis1", roundCurrency(row.dis1()));
        payload.put("dis2", roundCurrency(row.dis2()));
        payload.put("amount", roundCurrency(row.amount()));
        payload.put("deal", row.deal());
        payload.put("effective_cost_price", roundCurrency(row.effectiveCostPrice()));
        payload.put("medicine_category", row.medicineCategory());
        payload.put("medicine_type", row.medicineType());
        payload.put("medicine_description", row.medicineDescription());
        payload.put("medicine_uses", row.medicineUses());
        payload.put("medicine_doses", row.medicineDoses());
        return payload;
    }



    private static String profileCacheKey(InventoryRow row) {
        return (row.name().trim().toLowerCase(Locale.ROOT) + "|" + row.brand().trim().toLowerCase(Locale.ROOT) + "|" + row.pack().trim().toLowerCase(Locale.ROOT))
                .replaceAll("\\s+", " ");
    }

    private static String sha256(MultipartFile file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(file.getBytes());
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception ex) {
            throw new IllegalArgumentException("Unable to compute file hash", ex);
        }
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

    private static String bonusTextValue(InventoryRow row) {
        return row.bonusText();
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

    private record PricingOutcome(List<InventoryRow> rows, Map<String, Object> details) {}
    private record MedicineUpsertResult(Long medicineId, String action) {}
    private record MedicineProfileResolution(MedicineProfile profile, String source, double confidence) {}
    private static final class ProcessingStats {
        int geminiProfileCalls;
        int profileCacheHits;
        int profileDbHits;
        int fuzzyProfileMatches;
        int unknownFallbacks;
    }
}
