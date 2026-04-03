package com.healthplus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
class GeminiReceiptOcrService {
    private static final String MODEL = "gemini-2.5-flash";
    private static final Logger log = LoggerFactory.getLogger(GeminiReceiptOcrService.class);
    private final ObjectMapper objectMapper;
    private final VertexAiClientFactory clientFactory;

    GeminiReceiptOcrService(ObjectMapper objectMapper, VertexAiClientFactory clientFactory) {
        this.objectMapper = objectMapper;
        this.clientFactory = clientFactory;
    }

    ReceiptExtraction extract(MultipartFile file) {
        if (!clientFactory.isEnabled()) {
            throw new IllegalArgumentException("Vertex AI OCR is disabled. Enable app.ocr.vertexai.enabled to proceed.");
        }

        try {
            byte[] bytes = file.getBytes();
            String mimeType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();

            String systemPrompt = "Extract receipt into strict JSON. For deal, capture deal/lot/scheme/offer text and any actual rate noted. " +
                    "{\"agency\":{\"name\":string,\"gstin\":string,\"dl_no\":string,\"phone\":string,\"address\":string}," +
                    "\"bill\":{\"invoice_no\":string,\"bill_number\":string,\"invoice_date\":string,\"bill_total\":number}," +
                    "\"items\":[{\"product\":string,\"hsn\":string,\"mfr\":string,\"pack\":string,\"qty_fr\":string,\"bonus\":string,\"deal\":string,\"batch\":string,\"exp\":string," +
                    "\"mrp\":number,\"rate\":number,\"gst\":number,\"dis1\":number,\"dis2\":number,\"amount\":number}]}. " +
                    "Only item rows. Ignore totals/subtotals/tax summary. No markdown or extra keys.";

            GenerateContentConfig config = GenerateContentConfig.builder()
                    .systemInstruction(Content.fromParts(Part.fromText(systemPrompt)))
                    .build();
            Content content = Content.fromParts(
                    Part.fromText("Extract receipt data from the attached image."),
                    Part.fromBytes(bytes, mimeType)
            );

            String jsonText;
            try (Client client = clientFactory.newClient()) {
                GenerateContentResponse response = client.models.generateContent(MODEL, content, config);
                logUsage("ocr.extract", MODEL, response);
                jsonText = response == null ? "" : response.text();
            }

            if (jsonText == null || jsonText.isBlank()) {
                throw new IllegalArgumentException("Gemini OCR did not return extractable text");
            }

            jsonText = ReceiptOcrJsonSupport.stripMarkdownFence(jsonText);
            JsonNode extracted = objectMapper.readTree(jsonText);
            JsonNode agencyNode = extracted.path("agency");
            JsonNode billNode = extracted.path("bill");
            JsonNode items = extracted.path("items");
            if (!items.isArray()) {
                throw new IllegalArgumentException("Gemini OCR response missing items array");
            }

            ReceiptAgency agency = new ReceiptAgency(
                    ReceiptOcrJsonSupport.textOf(agencyNode, "name", "agency_name", "seller_name"),

                    ReceiptOcrJsonSupport.textOf(agencyNode, "gstin"),
                    ReceiptOcrJsonSupport.textOf(agencyNode, "dl_no", "dl", "dlno", "drug_license", "drug_licence"),
                    ReceiptOcrJsonSupport.textOf(agencyNode, "phone", "mobile", "contact"),
                    ReceiptOcrJsonSupport.textOf(agencyNode, "address")
            );
            ReceiptBill bill = new ReceiptBill(
                    ReceiptOcrJsonSupport.textOf(billNode, "invoice_no", "invoice_number"),
                    ReceiptOcrJsonSupport.textOf(billNode, "bill_number", "bill_no"),
                    ReceiptOcrJsonSupport.textOf(billNode, "invoice_date", "date"),
                    ReceiptOcrJsonSupport.numberOf(billNode, "bill_total", "net_amount", "total")
            );

            List<InventoryRow> rows = ReceiptOcrJsonSupport.parseItems(items);
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("strategy", "gemini-vision");
            meta.put("gemini_calls", 1);
            meta.put("cache_hit", false);
            return new ReceiptExtraction(
                    agency,
                    bill,
                    rows,
                    "gemini",
                    meta
            );
        } catch (Exception ex) {
            throw new IllegalArgumentException("Unable to run OCR for receipt", ex);
        }
    }

    GeminiProfileResult inferMedicineProfile(InventoryRow row) {
        if (!clientFactory.isEnabled()) {
            return new GeminiProfileResult(MedicineProfile.unknown("fallback"), false);
        }
        try {
            String systemPrompt = "Classify the product. Return ONLY JSON with keys: " +
                    "medicine_category, medicine_type, medicine_description, medicine_uses, medicine_doses. Use \"unknown\" if missing.";
            GenerateContentConfig config = GenerateContentConfig.builder()
                    .systemInstruction(Content.fromParts(Part.fromText(systemPrompt)))
                    .build();
            Content content = Content.fromParts(
                    Part.fromText("product_name: " + row.name()),
                    Part.fromText("manufacturer: " + (row.brand().isBlank() ? "unknown" : row.brand())),
                    Part.fromText("pack: " + (row.pack().isBlank() ? "unknown" : row.pack()))
            );

            String jsonText;
            try (Client client = clientFactory.newClient()) {
                GenerateContentResponse response = client.models.generateContent(MODEL, content, config);
                logUsage("ocr.profile", MODEL, response);
                jsonText = response == null ? "" : response.text();
            }
            if (jsonText == null || jsonText.isBlank()) {
                return new GeminiProfileResult(MedicineProfile.unknown("fallback"), true);
            }

            jsonText = ReceiptOcrJsonSupport.stripMarkdownFence(jsonText);
            JsonNode extracted = objectMapper.readTree(jsonText);
            MedicineProfile profile = new MedicineProfile(
                    ReceiptOcrJsonSupport.textOf(extracted, "medicine_category", "category"),
                    ReceiptOcrJsonSupport.textOf(extracted, "medicine_type", "type"),
                    ReceiptOcrJsonSupport.textOf(extracted, "medicine_description", "description"),
                    ReceiptOcrJsonSupport.textOf(extracted, "medicine_uses", "uses"),
                    ReceiptOcrJsonSupport.textOf(extracted, "medicine_doses", "doses"),
                    "gemini"
            );
            return new GeminiProfileResult(profile, true);
        } catch (Exception ignored) {
            return new GeminiProfileResult(MedicineProfile.unknown("fallback"), true);
        }
    }

    private static void logUsage(String operation, String model, GenerateContentResponse response) {
        if (response == null) {
            return;
        }
        response.usageMetadata().ifPresent(usage -> {
            Integer promptTokens = usage.promptTokenCount().orElse(null);
            Integer candidatesTokens = usage.candidatesTokenCount().orElse(null);
            Integer totalTokens = usage.totalTokenCount().orElse(null);
            Integer cachedTokens = usage.cachedContentTokenCount().orElse(null);
            Integer thoughtsTokens = usage.thoughtsTokenCount().orElse(null);
            Integer toolPromptTokens = usage.toolUsePromptTokenCount().orElse(null);
            log.info("VertexAI token usage operation={} model={} prompt_tokens={} candidates_tokens={} total_tokens={} cached_tokens={} thoughts_tokens={} tool_prompt_tokens={} ",
                    operation, model, promptTokens, candidatesTokens, totalTokens, cachedTokens, thoughtsTokens, toolPromptTokens);
        });
    }

    record GeminiProfileResult(MedicineProfile profile, boolean called) {}
}
