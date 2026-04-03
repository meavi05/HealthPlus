package com.healthplus.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.textract.TextractClient;
import software.amazon.awssdk.services.textract.TextractClientBuilder;
import software.amazon.awssdk.services.textract.model.AnalyzeDocumentRequest;
import software.amazon.awssdk.services.textract.model.AnalyzeDocumentResponse;
import software.amazon.awssdk.services.textract.model.AnalyzeExpenseRequest;
import software.amazon.awssdk.services.textract.model.AnalyzeExpenseResponse;
import software.amazon.awssdk.services.textract.model.Block;
import software.amazon.awssdk.services.textract.model.BlockType;
import software.amazon.awssdk.services.textract.model.Document;
import software.amazon.awssdk.services.textract.model.EntityType;
import software.amazon.awssdk.services.textract.model.ExpenseDocument;
import software.amazon.awssdk.services.textract.model.ExpenseField;
import software.amazon.awssdk.services.textract.model.ExpenseType;
import software.amazon.awssdk.services.textract.model.FeatureType;
import software.amazon.awssdk.services.textract.model.LineItemFields;
import software.amazon.awssdk.services.textract.model.LineItemGroup;
import software.amazon.awssdk.services.textract.model.Relationship;
import software.amazon.awssdk.services.textract.model.RelationshipType;
import software.amazon.awssdk.services.textract.model.SelectionStatus;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
class TextractReceiptOcrService {
    private static final Logger log = LoggerFactory.getLogger(TextractReceiptOcrService.class);

    @Value("${app.ocr.textract.enabled:false}")
    private boolean textractEnabled;
    @Value("${app.ocr.textract.region:}")
    private String textractRegion;
    @Value("${app.ocr.textract.endpoint:}")
    private String textractEndpoint;
    @Value("${app.ocr.textract.debug:false}")
    private boolean textractDebug;
    @Value("${app.ocr.textract.min-rows:2}")
    private int textractMinRows;
    @Value("${app.ocr.textract.analyze-document.enabled:true}")
    private boolean textractAnalyzeDocumentEnabled;
    @Value("${app.ocr.local.min-confidence:0.75}")
    private double localOcrMinConfidence;
    @Value("${app.ocr.local.max-ambiguous-ratio:0.35}")
    private double localOcrMaxAmbiguousRatio;

    boolean isEnabled() {
        return textractEnabled;
    }

    ReceiptExtraction extract(MultipartFile file) {
        if (!textractEnabled || file == null || file.isEmpty()) {
            return null;
        }
        if (!ReceiptOcrUtils.isImageOrPdf(file.getOriginalFilename(), file.getContentType())) {
            return null;
        }
        String region = resolveTextractRegion();
        if (region.isBlank()) {
            return null;
        }
        try (TextractClient client = buildTextractClient(region)) {
            byte[] bytes = file.getBytes();
            AnalyzeExpenseRequest request = AnalyzeExpenseRequest.builder()
                    .document(Document.builder().bytes(SdkBytes.fromByteArray(bytes)).build())
                    .build();
            AnalyzeExpenseResponse response = client.analyzeExpense(request);
            if (response == null || response.expenseDocuments().isEmpty()) {
                return null;
            }

            String vendorName = "";
            String vendorAddress = "";
            String vendorPhone = "";
            String vendorGstin = "";
            String vendorDlNo = "";
            String invoiceNo = "";
            String invoiceDate = "";
            double billTotal = 0;
            List<InventoryRow> rows = new ArrayList<>();
            List<Map<String, Object>> debugLineItems = textractDebug ? new ArrayList<>() : List.of();

            for (ExpenseDocument doc : response.expenseDocuments()) {
                List<ExpenseField> summaryFields = doc.summaryFields();
                if (vendorName.isBlank()) {
                    vendorName = expenseFieldValue(summaryFields, "VENDOR_NAME", "SUPPLIER_NAME", "MERCHANT_NAME", "SELLER_NAME");
                }
                if (vendorAddress.isBlank()) {
                    vendorAddress = expenseFieldValue(summaryFields, "VENDOR_ADDRESS", "SUPPLIER_ADDRESS", "REMIT_TO_ADDRESS", "RECEIPT_ADDRESS", "BILLING_ADDRESS", "SHIPPING_ADDRESS", "ADDRESS");
                }
                if (vendorPhone.isBlank()) {
                    vendorPhone = expenseFieldValue(summaryFields, "VENDOR_PHONE", "SUPPLIER_PHONE", "PHONE", "CONTACT");
                }
                if (vendorGstin.isBlank()) {
                    vendorGstin = expenseFieldValue(summaryFields, "GSTIN", "GST_NO", "GSTIN_UIN", "TAX_ID");
                }
                if (vendorDlNo.isBlank()) {
                    vendorDlNo = expenseFieldValue(summaryFields, "DL_NO", "DL_NUMBER", "DRUG_LICENSE", "DRUG_LICENCE", "LICENSE_NO");
                }
                if (invoiceNo.isBlank()) {
                    invoiceNo = expenseFieldValue(summaryFields, "INVOICE_RECEIPT_ID", "INVOICE_ID", "INVOICE_NO", "INVOICE_NUMBER", "BILL_NO", "RECEIPT_ID");
                }
                if (invoiceDate.isBlank()) {
                    invoiceDate = expenseFieldValue(summaryFields, "INVOICE_RECEIPT_DATE", "INVOICE_DATE", "RECEIPT_DATE", "DATE");
                }
                if (billTotal <= 0) {
                    billTotal = ReceiptOcrUtils.parsePrice(expenseFieldValue(summaryFields, "TOTAL", "AMOUNT_DUE", "NET_AMOUNT", "GRAND_TOTAL"));
                }

                for (LineItemGroup group : doc.lineItemGroups()) {
                    for (LineItemFields lineItem : group.lineItems()) {
                        List<ExpenseField> fields = lineItem.lineItemExpenseFields();
                        if (textractDebug) {
                            debugLineItems.add(expenseFieldDebug(fields));
                        }
                        String rowText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"EXPENSE_ROW"},
                                new String[]{"EXPENSE_ROW"},
                                null
                        );
                        String product = firstNonBlank(
                                expenseFieldValuePreferred(
                                        fields,
                                        new String[]{"ITEM", "ITEM_DESCRIPTION", "PRODUCT_NAME", "PRODUCT", "DESCRIPTION", "PARTICULARS"},
                                        new String[]{"ITEM", "ITEM_DESCRIPTION", "PRODUCT_NAME", "PRODUCT", "DESCRIPTION", "PARTICULARS"},
                                        null
                                ),
                                expenseFieldValuePreferred(
                                        fields,
                                        new String[]{"NAME", "ITEM_NAME"},
                                        new String[]{"NAME", "ITEM_NAME"},
                                        null
                                )
                        );
                        String hsn = expenseFieldValuePreferred(
                                fields,
                                new String[]{"HSN", "HSNCODE", "PRODUCT_CODE", "PRODUCTCODE"},
                                new String[]{"HSN", "HSNCODE", "PRODUCT_CODE", "PRODUCTCODE"},
                                null
                        );
                        String manufacturer = expenseFieldValuePreferred(
                                fields,
                                new String[]{"MANUFACTURER", "MFR", "MFR.", "MFG", "BRAND"},
                                new String[]{"MANUFACTURER", "MFR", "MFR.", "MFG", "BRAND"},
                                null
                        );
                        String pack = expenseFieldValuePreferred(
                                fields,
                                new String[]{"PACK", "PACKING", "PKG"},
                                new String[]{"PACK", "PACKING", "PKG"},
                                null
                        );
                        String qtyText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"QUANTITY", "QTY", "QTY+F/R", "QTY+FR", "QTY/FR", "QTY+FREE", "QTY+F"},
                                new String[]{"QUANTITY", "QTY", "QTY+F/R", "QTY+FR", "QTY/FR", "QTY+FREE", "QTY+F"},
                                null
                        );
                        String qtyFr = ReceiptOcrUtils.normalizeQtyFr(qtyText);
                        int qtyValue = ReceiptOcrUtils.parseQtyFr(qtyFr);
                        if (qtyValue <= 0 && qtyText != null && !qtyText.isBlank()) {
                            qtyValue = ReceiptOcrUtils.parseQuantity(qtyText);
                        }
                        if (qtyValue > 0 && qtyFr.isBlank()) {
                            qtyFr = String.valueOf(qtyValue);
                        }
                        String mrpText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"MRP", "OLDMRP", "OLD.MRP"},
                                new String[]{"UNIT_PRICE", "UNITPRICE", "PRICE_PER_UNIT"},
                                new String[]{"RATE", "UNITRATE", "UNIT_RATE"}
                        );
                        String rateText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"RATE", "UNIT_RATE", "UNITRATE"},
                                new String[]{"UNIT_PRICE", "UNITPRICE", "PRICE_PER_UNIT", "RATE", "UNIT_RATE"},
                                new String[]{"MRP", "OLDMRP", "OLD.MRP"}
                        );
                        String amountText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"AMOUNT", "PRICE", "LINE_ITEM_TOTAL", "TOTAL_PRICE", "LINE TOTAL", "TOTAL"},
                                new String[]{"AMOUNT", "PRICE", "LINE_ITEM_TOTAL", "TOTAL_PRICE", "LINE TOTAL", "TOTAL"},
                                null
                        );
                        String gstText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"GST", "GST%", "TAX", "TAXRATE"},
                                new String[]{"GST", "GST%", "TAX", "TAXRATE"},
                                null
                        );
                        String dis1Text = expenseFieldValuePreferred(
                                fields,
                                new String[]{"DIS1", "DISC1", "DISCOUNT1", "DISC", "DISCOUNT"},
                                new String[]{"DIS1", "DISC1", "DISCOUNT1", "DISC", "DISCOUNT"},
                                null
                        );
                        String dis2Text = expenseFieldValuePreferred(
                                fields,
                                new String[]{"DIS2", "DISC2", "DISCOUNT2"},
                                new String[]{"DIS2", "DISC2", "DISCOUNT2"},
                                null
                        );
                        String dealText = expenseFieldValuePreferred(
                                fields,
                                new String[]{"DEAL", "SCHEME", "OFFER", "PROMO", "LOT"},
                                new String[]{"DEAL", "SCHEME", "OFFER", "PROMO", "LOT"},
                                null
                        );
                        String batch = expenseFieldValuePreferred(
                                fields,
                                new String[]{"BATCH", "BATCHNO", "BATCHNO."},
                                new String[]{"BATCH", "BATCHNO", "BATCHNO."},
                                null
                        );
                        String exp = expenseFieldValuePreferred(
                                fields,
                                new String[]{"EXP", "EXPIRY", "EXPDATE", "EXPIRYDATE"},
                                new String[]{"EXP", "EXPIRY", "EXPDATE", "EXPIRYDATE"},
                                null
                        );
                        double mrp = ReceiptOcrUtils.parsePrice(mrpText);
                        double rate = ReceiptOcrUtils.parsePrice(rateText);
                        double amount = ReceiptOcrUtils.parsePrice(amountText);
                        double gst = ReceiptOcrUtils.parsePrice(gstText);
                        double dis1 = ReceiptOcrUtils.parsePrice(dis1Text);
                        double dis2 = ReceiptOcrUtils.parsePrice(dis2Text);
                        if (rowText != null && !rowText.isBlank()) {
                            String fallbackSource = rowText.trim();
                            if (product.isBlank()) {
                                product = fallbackSource;
                            }
                            if (dealText == null || dealText.isBlank()) {
                                dealText = ReceiptOcrUtils.extractDealText(fallbackSource);
                            }
                            if (hsn.isBlank()) {
                                hsn = findByPattern(fallbackSource, "(\\b\\d{6,8}\\b)");
                            }
                            if (batch.isBlank()) {
                                batch = findByPattern(fallbackSource, "\\b[A-Z0-9]{5,12}\\b");
                            }
                            if (exp.isBlank()) {
                                exp = findByPattern(fallbackSource, "\\b\\d{1,2}[/-]\\d{2,4}\\b");
                            }
                            if (qtyFr.isBlank()) {
                                qtyFr = extractQtyFrFromRow(fallbackSource);
                                qtyValue = ReceiptOcrUtils.parseQtyFr(qtyFr);
                            }
                            if (rate <= 0) {
                                rate = parseTrailingNumber(fallbackSource, 2);
                            }
                            if (amount <= 0) {
                                amount = parseTrailingNumber(fallbackSource, 1);
                            }
                        }
                        if (rate <= 0 && amount > 0 && qtyValue > 0) {
                            rate = amount / qtyValue;
                        }
                        if (amount <= 0 && rate > 0 && qtyValue > 0) {
                            amount = rate * qtyValue;
                        }
                        String bonusText = ReceiptOcrUtils.normalizeBonusText("", qtyFr);
                        int quantityAdded = ReceiptOcrUtils.parseQtyFr(qtyFr);
                        int bonusQty = ReceiptOcrUtils.parseBonusFromQtyFr(qtyFr);
                        double effectiveCostPrice = ReceiptOcrUtils.computeEffectiveCostPrice(
                                rate,
                                mrp,
                                gst,
                                dis1,
                                dis2,
                                qtyFr,
                                bonusText,
                                dealText == null ? "" : dealText,
                                quantityAdded,
                                bonusQty
                        );

                        InventoryRow row = new InventoryRow(
                                product,
                                hsn,
                                manufacturer,
                                pack,
                                qtyFr,
                                bonusText,
                                quantityAdded,
                                bonusQty,
                                batch,
                                exp,
                                mrp,
                                rate,
                                gst,
                                dis1,
                                dis2,
                                amount,
                                dealText == null ? "" : dealText,
                                effectiveCostPrice,
                                "",
                                "",
                                "",
                                "",
                                ""
                        );
                        if (row.name().isBlank() || row.quantity() <= 0 || !row.hasPricingEvidence()) {
                            continue;
                        }
                        rows.add(row);
                    }
                }
            }

            if (rows.isEmpty()) {
                return null;
            }

            ReceiptAgency agency = new ReceiptAgency(
                    vendorName.isBlank() ? "Unknown Agency" : vendorName,
                    vendorGstin,
                    vendorDlNo,
                    vendorPhone,
                    vendorAddress
            );
            ReceiptBill bill = new ReceiptBill(
                    invoiceNo,
                    "",
                    invoiceDate,
                    billTotal
            );
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("strategy", "textract-analyze-expense");
            meta.put("cache_hit", false);
            meta.put("gemini_calls", 0);
            meta.put("documents", response.expenseDocuments().size());
            meta.put("line_items", rows.size());
            if (response.responseMetadata() != null && response.responseMetadata().requestId() != null) {
                meta.put("request_id", response.responseMetadata().requestId());
            }
            if (textractDebug) {
                meta.put("debug_line_items", limitDebugItems(debugLineItems, 40));
                log.info("Textract debug: captured {} line items (showing up to 40)", debugLineItems.size());
            }
            return new ReceiptExtraction(agency, bill, rows, "textract", meta);
        } catch (Exception ignored) {
            return null;
        }
    }

    OcrAttempt attempt(MultipartFile file) {
        if (!textractEnabled || file == null || file.isEmpty()) {
            return null;
        }
        if (!ReceiptOcrUtils.isImageOrPdf(file.getOriginalFilename(), file.getContentType())) {
            return null;
        }
//        ReceiptExtraction extraction = extract(file);
//        if (extraction != null && !extraction.rows().isEmpty()) {
//            LocalExtractionAssessment assessment = assessExtraction(extraction.rows());
//            boolean tooFewRows = extraction.rows().size() < Math.max(1, textractMinRows);
//            Map<String, Object> details = new LinkedHashMap<>(extraction.extractionMeta());
//            details.put("rows", extraction.rows().size());
//            details.put("confidence", roundCurrency(assessment.confidence() * 100));
//            details.put("ambiguous_ratio", roundCurrency(assessment.ambiguousRatio() * 100));
//            boolean accepted = !assessment.shouldFallbackToGemini() && !tooFewRows;
//            Map<String, Object> step = step(
//                    "textract-ocr",
//                    accepted ? "success" : "warning",
//                    accepted ? "Textract OCR accepted" : "Textract extraction low confidence, escalating",
//                    details
//            );
//            if (accepted || !textractAnalyzeDocumentEnabled) {
//                return new OcrAttempt(extraction, step, accepted);
//            }
//            ReceiptExtraction fallback = extractWithAnalyzeDocument(file);
//            if (fallback != null && !fallback.rows().isEmpty()) {
//                LocalExtractionAssessment fallbackAssessment = assessExtraction(fallback.rows());
//                boolean fallbackTooFew = fallback.rows().size() < Math.max(1, textractMinRows);
//                Map<String, Object> fallbackDetails = new LinkedHashMap<>(fallback.extractionMeta());
//                fallbackDetails.put("rows", fallback.rows().size());
//                fallbackDetails.put("confidence", roundCurrency(fallbackAssessment.confidence() * 100));
//                fallbackDetails.put("ambiguous_ratio", roundCurrency(fallbackAssessment.ambiguousRatio() * 100));
//                boolean fallbackAccepted = !fallbackAssessment.shouldFallbackToGemini() && !fallbackTooFew;
//                Map<String, Object> fallbackStep = step(
//                        "textract-ocr",
//                        fallbackAccepted ? "success" : "warning",
//                        fallbackAccepted ? "Textract AnalyzeDocument accepted" : "Textract AnalyzeDocument low confidence, escalating",
//                        fallbackDetails
//                );
//                return new OcrAttempt(fallback, fallbackStep, fallbackAccepted);
//            }
//            return new OcrAttempt(extraction, step, false);
//        }
        if (textractAnalyzeDocumentEnabled) {
            ReceiptExtraction fallback = extractWithAnalyzeDocument(file);
            if (fallback != null && !fallback.rows().isEmpty()) {
                LocalExtractionAssessment fallbackAssessment = assessExtraction(fallback.rows());
                boolean fallbackTooFew = fallback.rows().size() < Math.max(1, textractMinRows);
                Map<String, Object> fallbackDetails = new LinkedHashMap<>(fallback.extractionMeta());
                fallbackDetails.put("rows", fallback.rows().size());
                fallbackDetails.put("confidence", roundCurrency(fallbackAssessment.confidence() * 100));
                fallbackDetails.put("ambiguous_ratio", roundCurrency(fallbackAssessment.ambiguousRatio() * 100));
                boolean fallbackAccepted = !fallbackAssessment.shouldFallbackToGemini() && !fallbackTooFew;
                Map<String, Object> fallbackStep = step(
                        "textract-ocr",
                        fallbackAccepted ? "success" : "warning",
                        fallbackAccepted ? "Textract AnalyzeDocument accepted" : "Textract AnalyzeDocument low confidence, escalating",
                        fallbackDetails
                );
                return new OcrAttempt(fallback, fallbackStep, fallbackAccepted);
            }
        }
        Map<String, Object> step = step("textract-ocr", "warning", "Textract produced no valid rows, escalating", Map.of("rows", 0));
        return new OcrAttempt(null, step, false);
    }

    private String resolveTextractRegion() {
        if (textractRegion != null && !textractRegion.isBlank()) {
            return textractRegion.trim();
        }
        String envRegion = System.getenv("AWS_REGION");
        if (envRegion == null || envRegion.isBlank()) {
            envRegion = System.getenv("AWS_DEFAULT_REGION");
        }
        return envRegion == null ? "" : envRegion.trim();
    }

    private TextractClient buildTextractClient(String region) {
        TextractClientBuilder builder = TextractClient.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create());
        if (textractEndpoint != null && !textractEndpoint.isBlank()) {
            builder.endpointOverride(URI.create(textractEndpoint.trim()));
        }
        return builder.build();
    }

    private ReceiptExtraction extractWithAnalyzeDocument(MultipartFile file) {
        String region = resolveTextractRegion();
        if (region.isBlank()) {
            return null;
        }
        try (TextractClient client = buildTextractClient(region)) {
            byte[] bytes = file.getBytes();
            AnalyzeDocumentRequest request = AnalyzeDocumentRequest.builder()
                    .document(Document.builder().bytes(SdkBytes.fromByteArray(bytes)).build())
                    .featureTypes(FeatureType.TABLES, FeatureType.FORMS)
                    .build();
            AnalyzeDocumentResponse response = client.analyzeDocument(request);
            if (response == null || response.blocks() == null || response.blocks().isEmpty()) {
                return null;
            }
            Map<String, Block> blocksById = new HashMap<>();
            for (Block block : response.blocks()) {
                if (block.id() != null) {
                    blocksById.put(block.id(), block);
                }
            }

            Map<String, String> formFields = extractFormKeyValues(response.blocks(), blocksById);
            String vendorName = findFormValue(formFields,
                    "VENDOR_NAME", "VENDOR", "SUPPLIER_NAME", "SUPPLIER", "MERCHANT", "SELLER", "BILLFROM", "BILLED_BY", "COMPANY", "STORE"
            );
            String vendorAddress = findFormValue(formFields,
                    "VENDOR_ADDRESS", "ADDRESS", "SELLER_ADDRESS", "SUPPLIER_ADDRESS", "BILL_FROM", "BILLFROM"
            );
            String vendorPhone = findFormValue(formFields,
                    "VENDOR_PHONE", "PHONE", "TEL", "MOBILE", "CONTACT"
            );
            String vendorGstin = findFormValue(formFields,
                    "GSTIN", "GST_NO", "GSTIN_UIN", "GSTIN/UIN", "TAX_ID"
            );
            String vendorDlNo = findFormValue(formFields,
                    "DL_NO", "DL_NO.", "DL_NUMBER", "D.L.NO", "DRUG_LICENSE", "DRUG_LICENCE", "LICENSE_NO"
            );
            String invoiceNo = findFormValue(formFields,
                    "INVOICE_RECEIPT_ID", "INVOICE_ID", "INVOICE_NO", "INVOICE_NUMBER", "BILL_NO", "RECEIPT_ID", "REF_NO"
            );
            String invoiceDate = findFormValue(formFields,
                    "INVOICE_RECEIPT_DATE", "INVOICE_DATE", "RECEIPT_DATE", "DATE"
            );
            double billTotal = ReceiptOcrUtils.parsePrice(findFormValue(formFields,
                    "TOTAL", "GRAND_TOTAL","NET_AMOU", "NET_AMOUNT", "AMOUNT_DUE", "BALANCE_DUE"
            ));
            List<LineText> allLines = extractLines(response.blocks());
            double headerTop = findTableHeaderTop(allLines);
            List<LineText> headerCandidates = new ArrayList<>();
            if (headerTop > 0) {
                for (LineText line : allLines) {
                    if (line.top() < headerTop) {
                        headerCandidates.add(line);
                    }
                }
            } else {
                headerCandidates.addAll(allLines);
            }
            if (headerCandidates.isEmpty()) {
                headerCandidates.addAll(allLines);
            }
            if (vendorName.isBlank()) {
                vendorName = pickVendorNameFromLines(headerCandidates);
            }
            if (vendorAddress.isBlank()) {
                vendorAddress = pickVendorAddressFromLines(headerCandidates, vendorName);
            }
            if (vendorGstin.isBlank()) {
                vendorGstin = findGstinFromLines(headerCandidates);
            }
            if (vendorDlNo.isBlank()) {
                vendorDlNo = findDlNumberFromLines(headerCandidates);
            }

            List<TableData> tables = new ArrayList<>();
            for (Block block : response.blocks()) {
                if (block.blockType() == BlockType.TABLE) {
                    TableData table = buildTable(block, blocksById);
                    if (table != null && table.rowCount() >= 2) {
                        tables.add(table);
                    }
                }
            }
            if (tables.isEmpty()) {
                return null;
            }
            tables.sort(Comparator.comparingInt(TableData::rowCount).reversed());
            TableData best = tables.get(0);
            List<InventoryRow> rows = tableToRows(best);
            if (rows.isEmpty()) {
                return null;
            }

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("strategy", "textract-analyze-document");
            meta.put("cache_hit", false);
            meta.put("gemini_calls", 0);
            meta.put("tables", tables.size());
            meta.put("rows", rows.size());
            if (response.responseMetadata() != null && response.responseMetadata().requestId() != null) {
                meta.put("request_id", response.responseMetadata().requestId());
            }
            if (textractDebug && !formFields.isEmpty()) {
                meta.put("form_fields", limitDebugFormFields(formFields, 30));
            }
            if (textractDebug && !headerCandidates.isEmpty()) {
                meta.put("header_lines", limitDebugLines(headerCandidates, 12));
                if (!vendorName.isBlank()) {
                    meta.put("picked_agency", vendorName);
                }
                if (!vendorAddress.isBlank()) {
                    meta.put("picked_address", vendorAddress);
                }
            }
            ReceiptAgency agency = new ReceiptAgency(
                    vendorName.isBlank() ? "Unknown Agency" : vendorName,
                    vendorGstin,
                    vendorDlNo,
                    vendorPhone,
                    vendorAddress
            );
            ReceiptBill bill = new ReceiptBill(
                    invoiceNo,
                    "",
                    invoiceDate,
                    billTotal
            );
            return new ReceiptExtraction(agency, bill, rows, "textract", meta);
        } catch (Exception ignored) {
            return null;
        }
    }

    private TableData buildTable(Block table, Map<String, Block> blocksById) {
        Map<Integer, Map<Integer, String>> rows = new TreeMap<>();
        List<Relationship> relationships = table.relationships();
        if (relationships == null) {
            return null;
        }
        for (Relationship relationship : relationships) {
            if (relationship.type() != RelationshipType.CHILD || relationship.ids() == null) {
                continue;
            }
            for (String id : relationship.ids()) {
                Block cell = blocksById.get(id);
                if (cell == null || cell.blockType() != BlockType.CELL) {
                    continue;
                }
                int rowIndex = cell.rowIndex() == null ? 0 : cell.rowIndex();
                int colIndex = cell.columnIndex() == null ? 0 : cell.columnIndex();
                if (rowIndex <= 0 || colIndex <= 0) {
                    continue;
                }
                String text = extractCellText(cell, blocksById);
                rows.computeIfAbsent(rowIndex, ignored -> new TreeMap<>()).put(colIndex, text);
            }
        }
        return rows.isEmpty() ? null : new TableData(rows);
    }

    private static String extractCellText(Block cell, Map<String, Block> blocksById) {
        StringBuilder sb = new StringBuilder();
        List<Relationship> relationships = cell.relationships();
        if (relationships == null) {
            return "";
        }
        for (Relationship relationship : relationships) {
            if (relationship.type() != RelationshipType.CHILD || relationship.ids() == null) {
                continue;
            }
            for (String id : relationship.ids()) {
                Block child = blocksById.get(id);
                if (child == null) {
                    continue;
                }
                if (child.blockType() == BlockType.WORD && child.text() != null) {
                    if (!sb.isEmpty()) {
                        sb.append(' ');
                    }
                    sb.append(child.text());
                }
            }
        }
        return sb.toString().trim();
    }

    private static List<InventoryRow> tableToRows(TableData table) {
        Map<Integer, Map<Integer, String>> rows = table.rows();
        if (rows.isEmpty()) {
            return List.of();
        }
        int headerRowIndex = detectHeaderRow(rows);
        Map<Integer, String> header = headerRowIndex > 0 ? rows.get(headerRowIndex) : Map.of();
        Map<Integer, String> columnMap = headerRowIndex > 0 ? buildHeaderMap(header) : buildDefaultMap(rows);
        if (columnMap.isEmpty()) {
            return List.of();
        }
        List<InventoryRow> results = new ArrayList<>();
        for (Map.Entry<Integer, Map<Integer, String>> entry : rows.entrySet()) {
            int rowIndex = entry.getKey();
            if (headerRowIndex > 0 && rowIndex <= headerRowIndex) {
                continue;
            }
            Map<Integer, String> cells = entry.getValue();
            if (cells == null || cells.isEmpty()) {
                continue;
            }
            Map<String, String> fields = new LinkedHashMap<>();
            for (Map.Entry<Integer, String> cell : cells.entrySet()) {
                String key = columnMap.get(cell.getKey());
                if (key == null || key.isBlank()) {
                    continue;
                }
                fields.put(key, cell.getValue() == null ? "" : cell.getValue().trim());
            }
            String product = fields.getOrDefault("product", "");
            String hsn = fields.getOrDefault("hsn", "");
            String mfr = fields.getOrDefault("mfr", "");
            String pack = fields.getOrDefault("pack", "");
            String qtyFr = ReceiptOcrUtils.normalizeQtyFr(fields.getOrDefault("qty", ""));
            String bonusText = ReceiptOcrUtils.normalizeBonusText(fields.getOrDefault("bonus", ""), qtyFr);
            int quantityAdded = ReceiptOcrUtils.parseQtyFr(qtyFr);
            int bonusQty = ReceiptOcrUtils.parseBonusFromQtyFr(qtyFr);
            String batch = fields.getOrDefault("batch", "");
            String exp = fields.getOrDefault("exp", "");
            double mrp = ReceiptOcrUtils.parsePrice(fields.getOrDefault("mrp", ""));
            double rate = ReceiptOcrUtils.parsePrice(fields.getOrDefault("rate", ""));
            double gst = ReceiptOcrUtils.parsePrice(fields.getOrDefault("gst", ""));
            double dis1 = ReceiptOcrUtils.parsePrice(fields.getOrDefault("dis1", ""));
            double dis2 = ReceiptOcrUtils.parsePrice(fields.getOrDefault("dis2", ""));
            double amount = ReceiptOcrUtils.parsePrice(fields.getOrDefault("amount", ""));
            String deal = fields.getOrDefault("deal", "");
            double effectiveCostPrice = ReceiptOcrUtils.computeEffectiveCostPrice(
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

            InventoryRow row = new InventoryRow(
                    product,
                    hsn,
                    mfr,
                    pack,
                    qtyFr,
                    bonusText,
                    quantityAdded,
                    bonusQty,
                    batch,
                    exp,
                    mrp,
                    rate,
                    gst,
                    dis1,
                    dis2,
                    amount,
                    deal,
                    effectiveCostPrice,
                    "",
                    "",
                    "",
                    "",
                    ""
            );
            if (row.name().isBlank() || row.quantity() <= 0 || !row.hasPricingEvidence()) {
                continue;
            }
            results.add(row);
        }
        return results;
    }

    private static int detectHeaderRow(Map<Integer, Map<Integer, String>> rows) {
        int bestRow = -1;
        int bestScore = 0;
        for (Map.Entry<Integer, Map<Integer, String>> entry : rows.entrySet()) {
            int score = 0;
            for (String value : entry.getValue().values()) {
                if (headerKey(value) != null) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestRow = entry.getKey();
            }
        }
        return bestScore >= 2 ? bestRow : -1;
    }

    private static Map<Integer, String> buildHeaderMap(Map<Integer, String> headerRow) {
        Map<Integer, String> columnMap = new LinkedHashMap<>();
        for (Map.Entry<Integer, String> entry : headerRow.entrySet()) {
            String key = headerKey(entry.getValue());
            if (key != null && !columnMap.containsValue(key)) {
                columnMap.put(entry.getKey(), key);
            }
        }
        return columnMap;
    }

    private static Map<Integer, String> buildDefaultMap(Map<Integer, Map<Integer, String>> rows) {
        Map<Integer, String> columnMap = new LinkedHashMap<>();
        Map<Integer, String> firstRow = rows.values().stream().findFirst().orElse(Map.of());
        List<Integer> columns = new ArrayList<>(firstRow.keySet());
        columns.sort(Integer::compareTo);
        List<String> defaultOrder = List.of("product", "hsn", "mfr", "pack", "qty", "deal", "batch", "exp", "mrp", "rate", "gst", "dis1", "dis2", "amount");
        for (int i = 0; i < columns.size() && i < defaultOrder.size(); i++) {
            columnMap.put(columns.get(i), defaultOrder.get(i));
        }
        return columnMap;
    }

    private static String headerKey(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "");
        if (normalized.contains("PRODUCT") || normalized.contains("ITEM") || normalized.contains("NAME")) {
            return "product";
        }
        if (normalized.contains("HSN")) {
            return "hsn";
        }
        if (normalized.contains("MFR") || normalized.contains("MANUF") || normalized.contains("MFG")) {
            return "mfr";
        }
        if (normalized.contains("PACK")) {
            return "pack";
        }
        if (normalized.contains("QTY") || normalized.contains("QUANTITY")) {
            return "qty";
        }
        if (normalized.contains("DEAL") || normalized.contains("SCHEME") || normalized.contains("OFFER") || normalized.contains("LOT")) {
            return "deal";
        }
        if (normalized.contains("BATCH")) {
            return "batch";
        }
        if (normalized.startsWith("EXP")) {
            return "exp";
        }
        if (normalized.contains("MRP")) {
            return "mrp";
        }
        if (normalized.contains("RATE") || normalized.contains("UNITPRICE")) {
            return "rate";
        }
        if (normalized.contains("GST") || normalized.contains("TAX")) {
            return "gst";
        }
        if (normalized.contains("DIS2") || normalized.contains("DISC2") || normalized.contains("DISCOUNT2")) {
            return "dis2";
        }
        if (normalized.contains("DIS1") || normalized.contains("DISC1") || normalized.contains("DISCOUNT") || normalized.contains("DISC")) {
            return "dis1";
        }
        if (normalized.contains("AMOUNT") || normalized.contains("TOTAL")) {
            return "amount";
        }
        return null;
    }

    private record TableData(Map<Integer, Map<Integer, String>> rows) {
        int rowCount() {
            return rows == null ? 0 : rows.size();
        }
    }

    private static String expenseFieldValue(List<ExpenseField> fields, String... keys) {
        if (fields == null || fields.isEmpty()) {
            return "";
        }
        for (ExpenseField field : fields) {
            if (field == null) {
                continue;
            }
            ExpenseType type = field.type();
            String typeText = type == null ? "" : type.text();
            String labelText = field.labelDetection() == null ? "" : field.labelDetection().text();
            String normalizedType = normalizeFieldKey(typeText);
            String normalizedLabel = normalizeFieldKey(labelText);
            for (String key : keys) {
                if (key == null || key.isBlank()) {
                    continue;
                }
                String normalizedKey = normalizeFieldKey(key);
                if (!normalizedKey.isBlank() && (normalizedKey.equals(normalizedType) || normalizedKey.equals(normalizedLabel))) {
                    String value = field.valueDetection() == null ? "" : field.valueDetection().text();
                    return value == null ? "" : value.trim();
                }
            }
        }
        return "";
    }

    private static String expenseFieldValuePreferred(
            List<ExpenseField> fields,
            String[] labelKeys,
            String[] typeKeys,
            String[] blockedLabels
    ) {
        String byLabel = expenseFieldValueByLabel(fields, labelKeys);
        if (!byLabel.isBlank()) {
            return byLabel;
        }
        return expenseFieldValueByType(fields, typeKeys, blockedLabels);
    }

    private static String expenseFieldValueByLabel(List<ExpenseField> fields, String[] keys) {
        if (fields == null || fields.isEmpty() || keys == null || keys.length == 0) {
            return "";
        }
        for (ExpenseField field : fields) {
            if (field == null || field.labelDetection() == null) {
                continue;
            }
            String normalizedLabel = normalizeFieldKey(field.labelDetection().text());
            if (matchesKey(normalizedLabel, keys)) {
                String value = field.valueDetection() == null ? "" : field.valueDetection().text();
                return value == null ? "" : value.trim();
            }
        }
        return "";
    }

    private static String expenseFieldValueByType(List<ExpenseField> fields, String[] keys, String[] blockedLabels) {
        if (fields == null || fields.isEmpty() || keys == null || keys.length == 0) {
            return "";
        }
        for (ExpenseField field : fields) {
            if (field == null) {
                continue;
            }
            ExpenseType type = field.type();
            String normalizedType = normalizeFieldKey(type == null ? "" : type.text());
            String normalizedLabel = field.labelDetection() == null ? "" : normalizeFieldKey(field.labelDetection().text());
            if (matchesKey(normalizedType, keys) && !matchesKey(normalizedLabel, blockedLabels)) {
                String value = field.valueDetection() == null ? "" : field.valueDetection().text();
                return value == null ? "" : value.trim();
            }
        }
        return "";
    }

    private static boolean matchesKey(String normalizedValue, String[] keys) {
        if (normalizedValue == null || normalizedValue.isBlank() || keys == null || keys.length == 0) {
            return false;
        }
        for (String key : keys) {
            if (key == null || key.isBlank()) {
                continue;
            }
            String normalizedKey = normalizeFieldKey(key);
            if (!normalizedKey.isBlank() && normalizedKey.equals(normalizedValue)) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeFieldKey(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        normalized = normalized.replaceAll("[^A-Z0-9]+", "");
        return normalized;
    }

    private static String findByPattern(String input, String pattern) {
        if (input == null || input.isBlank()) {
            return "";
        }
        Matcher matcher = Pattern.compile(pattern).matcher(input);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return "";
    }

    private static String extractQtyFrFromRow(String rowText) {
        if (rowText == null || rowText.isBlank()) {
            return "";
        }
        Matcher matcher = Pattern.compile("\\b\\d+\\s*(?:[+/]\\s*\\d+)?\\b").matcher(rowText);
        if (matcher.find()) {
            return ReceiptOcrUtils.normalizeQtyFr(matcher.group());
        }
        return "";
    }

    private static double parseTrailingNumber(String rowText, int positionFromEnd) {
        if (rowText == null || rowText.isBlank()) {
            return 0;
        }
        Matcher matcher = Pattern.compile("(\\d+(?:\\.\\d+)?)").matcher(rowText);
        List<Double> numbers = new ArrayList<>();
        while (matcher.find()) {
            numbers.add(ReceiptOcrUtils.parsePrice(matcher.group(1)));
        }
        if (numbers.isEmpty()) {
            return 0;
        }
        int index = numbers.size() - Math.max(1, positionFromEnd);
        if (index < 0) {
            return 0;
        }
        return numbers.get(index);
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private Map<String, Object> expenseFieldDebug(List<ExpenseField> fields) {
        Map<String, Object> payload = new LinkedHashMap<>();
        List<Map<String, Object>> entries = new ArrayList<>();
        if (fields != null) {
            for (ExpenseField field : fields) {
                if (field == null) {
                    continue;
                }
                ExpenseType type = field.type();
                String typeText = type == null ? "" : type.text();
                String labelText = field.labelDetection() == null ? "" : field.labelDetection().text();
                String value = field.valueDetection() == null ? "" : field.valueDetection().text();
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("type", typeText == null ? "" : typeText.trim());
                entry.put("label", labelText == null ? "" : labelText.trim());
                entry.put("value", ReceiptOcrUtils.truncateForDebug(value == null ? "" : value.trim(), 160));
                entries.add(entry);
            }
        }
        payload.put("fields", entries);
        return payload;
    }

    private static List<Map<String, Object>> limitDebugItems(List<Map<String, Object>> items, int limit) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        int end = Math.min(items.size(), Math.max(1, limit));
        return new ArrayList<>(items.subList(0, end));
    }

    private static Map<String, String> extractFormKeyValues(List<Block> blocks, Map<String, Block> blocksById) {
        if (blocks == null || blocks.isEmpty() || blocksById == null || blocksById.isEmpty()) {
            return Map.of();
        }
        Map<String, String> results = new LinkedHashMap<>();
        for (Block block : blocks) {
            if (block == null || block.blockType() != BlockType.KEY_VALUE_SET || block.entityTypes() == null) {
                continue;
            }
            if (!block.entityTypes().contains(EntityType.KEY)) {
                continue;
            }
            String keyText = extractBlockText(block, blocksById);
            if (keyText.isBlank()) {
                continue;
            }
            String valueText = "";
            List<Relationship> relationships = block.relationships();
            if (relationships != null) {
                for (Relationship relationship : relationships) {
                    if (relationship.type() != RelationshipType.VALUE || relationship.ids() == null) {
                        continue;
                    }
                    for (String valueId : relationship.ids()) {
                        Block valueBlock = blocksById.get(valueId);
                        if (valueBlock == null) {
                            continue;
                        }
                        valueText = extractBlockText(valueBlock, blocksById);
                        if (!valueText.isBlank()) {
                            break;
                        }
                    }
                }
            }
            if (!valueText.isBlank()) {
                results.putIfAbsent(keyText.trim(), valueText.trim());
            }
        }
        return results;
    }

    private static String extractBlockText(Block block, Map<String, Block> blocksById) {
        if (block == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        List<Relationship> relationships = block.relationships();
        if (relationships == null) {
            return "";
        }
        for (Relationship relationship : relationships) {
            if (relationship.type() != RelationshipType.CHILD || relationship.ids() == null) {
                continue;
            }
            for (String id : relationship.ids()) {
                Block child = blocksById.get(id);
                if (child == null) {
                    continue;
                }
                if (child.blockType() == BlockType.WORD && child.text() != null) {
                    if (!sb.isEmpty()) {
                        sb.append(' ');
                    }
                    sb.append(child.text());
                } else if (child.blockType() == BlockType.SELECTION_ELEMENT && child.selectionStatus() == SelectionStatus.SELECTED) {
                    if (!sb.isEmpty()) {
                        sb.append(' ');
                    }
                    sb.append("X");
                }
            }
        }
        return sb.toString().trim();
    }

    private static String findFormValue(Map<String, String> formFields, String... keys) {
        if (formFields == null || formFields.isEmpty() || keys == null || keys.length == 0) {
            return "";
        }
        for (String key : keys) {
            if (key == null || key.isBlank()) {
                continue;
            }
            String normalizedKey = normalizeFieldKey(key);
            for (Map.Entry<String, String> entry : formFields.entrySet()) {
                String normalizedEntry = normalizeFieldKey(entry.getKey());
                if (normalizedEntry.isBlank()) {
                    continue;
                }
                if (normalizedEntry.equals(normalizedKey) || normalizedEntry.contains(normalizedKey)) {
                    return entry.getValue() == null ? "" : entry.getValue().trim();
                }
            }
        }
        return "";
    }

    private static Map<String, String> limitDebugFormFields(Map<String, String> formFields, int limit) {
        if (formFields == null || formFields.isEmpty()) {
            return Map.of();
        }
        Map<String, String> limited = new LinkedHashMap<>();
        int count = 0;
        for (Map.Entry<String, String> entry : formFields.entrySet()) {
            limited.put(entry.getKey(), ReceiptOcrUtils.truncateForDebug(entry.getValue(), 160));
            count++;
            if (count >= Math.max(1, limit)) {
                break;
            }
        }
        return limited;
    }

    private static List<LineText> extractLines(List<Block> blocks) {
        if (blocks == null || blocks.isEmpty()) {
            return List.of();
        }
        List<LineText> lines = new ArrayList<>();
        for (Block block : blocks) {
            if (block == null || block.blockType() != BlockType.LINE || block.text() == null) {
                continue;
            }
            String text = block.text().trim();
            if (text.isBlank()) {
                continue;
            }
            double top = 1.0;
            double left = 0.0;
            double height = 0.0;
            double width = 0.0;
            if (block.geometry() != null && block.geometry().boundingBox() != null) {
                top = block.geometry().boundingBox().top() == null ? 1.0 : block.geometry().boundingBox().top();
                left = block.geometry().boundingBox().left() == null ? 0.0 : block.geometry().boundingBox().left();
                height = block.geometry().boundingBox().height() == null ? 0.0 : block.geometry().boundingBox().height();
                width = block.geometry().boundingBox().width() == null ? 0.0 : block.geometry().boundingBox().width();
            }
            lines.add(new LineText(text, top, left, height, width));
        }
        lines.sort(Comparator.comparingDouble(LineText::top).thenComparingDouble(LineText::left));
        return lines;
    }

    private static double findTableHeaderTop(List<LineText> lines) {
        if (lines == null || lines.isEmpty()) {
            return -1;
        }
        double best = -1;
        for (LineText line : lines) {
            String normalized = line.text().toLowerCase(Locale.ROOT);
            if (looksLikeTableHeader(normalized)) {
                best = best < 0 ? line.top() : Math.min(best, line.top());
            }
        }
        return best;
    }

    private static String pickVendorNameFromLines(List<LineText> lines) {
        if (lines == null || lines.isEmpty()) {
            return "";
        }
        String keywordPick = pickBestVendorLine(lines, true);
        if (!keywordPick.isBlank()) {
            return keywordPick;
        }
        return pickBestVendorLine(lines, false);
    }

    private static String pickBestVendorLine(List<LineText> lines, boolean requireKeyword) {
        double bestScore = -1;
        String best = "";
        for (LineText line : lines) {
            String text = line.text();
            if (text.isBlank()) {
                continue;
            }
            String normalized = text.toLowerCase(Locale.ROOT);
            if (looksLikeNoiseHeader(normalized) || looksLikeTableHeader(normalized)) {
                continue;
            }
            boolean hasKeyword = containsBusinessKeyword(normalized);
            if (requireKeyword && !hasKeyword) {
                continue;
            }
            int letters = countLetters(text);
            int digits = countDigits(text);
            int length = text.length();
            if (letters < 3 || letters < digits) {
                continue;
            }
            double letterRatio = letters / (double) Math.max(1, length);
            if (letterRatio < 0.4) {
                continue;
            }
            double score = letters;
            score += line.height() * 1200;
            score += line.width() * 60;
            score += Math.max(0, 8 - line.top() * 8);
            if (hasKeyword) {
                score += 20;
            }
            if (looksLikeAddressLine(normalized)) {
                score -= 10;
            }
            if (score > bestScore) {
                bestScore = score;
                best = text.trim();
            }
        }
        return best;
    }

    private static String pickVendorAddressFromLines(List<LineText> lines, String vendorName) {
        if (lines == null || lines.isEmpty()) {
            return "";
        }
        int startIndex = 0;
        if (vendorName != null && !vendorName.isBlank()) {
            for (int i = 0; i < lines.size(); i++) {
                if (lines.get(i).text().equalsIgnoreCase(vendorName)) {
                    startIndex = i + 1;
                    break;
                }
            }
        }
        StringBuilder sb = new StringBuilder();
        int appended = 0;
        for (int i = startIndex; i < lines.size() && appended < 3; i++) {
            String text = lines.get(i).text();
            if (text.isBlank()) {
                continue;
            }
            String normalized = text.toLowerCase(Locale.ROOT);
            if (looksLikeNoiseHeader(normalized) || looksLikeTableHeader(normalized)) {
                break;
            }
            if (!sb.isEmpty()) {
                sb.append(", ");
            }
            sb.append(text.trim());
            appended++;
        }
        return sb.toString().trim();
    }

    private static String findGstinFromLines(List<LineText> lines) {
        if (lines == null || lines.isEmpty()) {
            return "";
        }
        Pattern pattern = Pattern.compile("\\b\\d{2}[A-Z]{5}\\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}\\b");
        for (LineText line : lines) {
            Matcher matcher = pattern.matcher(line.text());
            if (matcher.find()) {
                return matcher.group();
            }
        }
        return "";
    }

    private static String findDlNumberFromLines(List<LineText> lines) {
        if (lines == null || lines.isEmpty()) {
            return "";
        }
        Pattern explicit = Pattern.compile("(?i)\\bD\\.?L\\.?\\s*No\\.?\\s*[:\\-]?\\s*([A-Z0-9/\\-]+)");
        Pattern loose = Pattern.compile("(?i)\\bDL\\b\\s*[:\\-]?\\s*([A-Z0-9/\\-]{4,})");
        for (LineText line : lines) {
            String text = line.text();
            Matcher matcher = explicit.matcher(text);
            if (matcher.find()) {
                return matcher.group(1).trim();
            }
            matcher = loose.matcher(text);
            if (matcher.find()) {
                return matcher.group(1).trim();
            }
        }
        return "";
    }

    private static boolean containsBusinessKeyword(String normalized) {
        return normalized.contains("medical")
                || normalized.contains("pharmacy")
                || normalized.contains("chemist")
                || normalized.contains("agency")
                || normalized.contains("hospital")
                || normalized.contains("clinic")
                || normalized.contains("drug")
                || normalized.contains("pharma")
                || normalized.contains("store");
    }

    private static boolean looksLikeAddressLine(String normalized) {
        return normalized.contains("road")
                || normalized.contains("rd")
                || normalized.contains("street")
                || normalized.contains("st")
                || normalized.contains("nagar")
                || normalized.contains("colony")
                || normalized.contains("pincode")
                || normalized.contains("pin")
                || normalized.contains("dist")
                || normalized.contains("district")
                || normalized.contains("state")
                || normalized.contains("near")
                || normalized.contains("opp")
                || normalized.contains("po");
    }

    private static boolean looksLikeNoiseHeader(String normalized) {
        return normalized.contains("invoice")
                || normalized.contains("bill")
                || normalized.contains("tax")
                || normalized.contains("gst")
                || normalized.contains("date")
                || normalized.contains("total")
                || normalized.contains("amount")
                || normalized.contains("qty")
                || normalized.contains("rate")
                || normalized.contains("page");
    }

    private static boolean looksLikeTableHeader(String normalized) {
        return normalized.contains("product")
                || normalized.contains("hsn")
                || normalized.contains("batch")
                || normalized.contains("exp")
                || normalized.contains("qty")
                || normalized.contains("mrp")
                || normalized.contains("rate")
                || normalized.contains("amount");
    }

    private static int countLetters(String text) {
        int count = 0;
        for (int i = 0; i < text.length(); i++) {
            if (Character.isLetter(text.charAt(i))) {
                count++;
            }
        }
        return count;
    }

    private static int countDigits(String text) {
        int count = 0;
        for (int i = 0; i < text.length(); i++) {
            if (Character.isDigit(text.charAt(i))) {
                count++;
            }
        }
        return count;
    }

    private static List<String> limitDebugLines(List<LineText> lines, int limit) {
        if (lines == null || lines.isEmpty()) {
            return List.of();
        }
        int end = Math.min(lines.size(), Math.max(1, limit));
        List<String> out = new ArrayList<>();
        for (int i = 0; i < end; i++) {
            out.add(ReceiptOcrUtils.truncateForDebug(lines.get(i).text(), 160));
        }
        return out;
    }

    private LocalExtractionAssessment assessExtraction(List<InventoryRow> rows) {
        if (rows.isEmpty()) {
            return new LocalExtractionAssessment(0, 1, true);
        }
        int ambiguous = 0;
        double confidenceSum = 0;
        for (InventoryRow row : rows) {
            double rowConfidence = 1.0;
            if (row.name().isBlank()) {
                rowConfidence -= 0.4;
            }
            if (row.quantity() <= 0) {
                rowConfidence -= 0.35;
            }
            if (row.effectiveCostPrice() <= 0) {
                rowConfidence -= 0.35;
            }
            if (ReceiptOcrUtils.parseQtyFr(row.qtyFr()) <= 0 && row.amount() > 0 && row.rate() > 0) {
                rowConfidence -= 0.2;
            }
            double expected = row.rate() * Math.max(1, row.quantity());
            if (row.amount() > 0 && expected > 0) {
                double ratio = Math.abs(expected - row.amount()) / expected;
                if (ratio > 0.4) {
                    rowConfidence -= 0.2;
                }
            }
            rowConfidence = Math.max(0, Math.min(1, rowConfidence));
            confidenceSum += rowConfidence;
            if (rowConfidence < 0.65) {
                ambiguous++;
            }
        }
        double avgConfidence = confidenceSum / rows.size();
        double ambiguousRatio = (double) ambiguous / rows.size();
        boolean fallback = avgConfidence < localOcrMinConfidence || ambiguousRatio > localOcrMaxAmbiguousRatio;
        return new LocalExtractionAssessment(avgConfidence, ambiguousRatio, fallback);
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

    private record LineText(String text, double top, double left, double height, double width) {}
}
