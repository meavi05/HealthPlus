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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
class GeminiReceiptValidationService {
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";
    private static final Logger log = LoggerFactory.getLogger(GeminiReceiptValidationService.class);
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final boolean includeImage;
    private final String model;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final int maxAttempts;
    private final VertexAiClientFactory clientFactory;

    GeminiReceiptValidationService(ObjectMapper objectMapper,
                                   @Value("${app.ocr.validation.enabled:false}") boolean enabled,
                                   @Value("${app.ocr.validation.include-image:false}") boolean includeImage,
                                   @Value("${app.ocr.validation.model:}") String model,
                                   @Value("${app.ocr.validation.connect-timeout-ms:15000}") int connectTimeoutMs,
                                   @Value("${app.ocr.validation.read-timeout-ms:45000}") int readTimeoutMs,
                                   @Value("${app.ocr.validation.max-attempts:2}") int maxAttempts,
                                   VertexAiClientFactory clientFactory) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.includeImage = includeImage;
        this.model = normalizeModelName(model);
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.clientFactory = clientFactory;
    }

    ValidationResult validate(ReceiptExtraction extraction, MultipartFile file) {
        if (!enabled) {
            return ValidationResult.skipped();
        }
        if (!clientFactory.isEnabled()) {
            return ValidationResult.skipped();
        }

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                Map<String, Object> input = buildValidationInput(extraction);
                String payloadText = objectMapper.writeValueAsString(input);

                GenerateContentConfig config = GenerateContentConfig.builder()
                        .systemInstruction(Content.fromParts(Part.fromText(validationPrompt())))
                        .build();

                List<Part> parts = new ArrayList<>();
                parts.add(Part.fromText(payloadText));
                if (includeImage && file != null && !file.isEmpty()) {
                    byte[] bytes = file.getBytes();
                    String mimeType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
                    parts.add(Part.fromBytes(bytes, mimeType));
                }
                Content content = Content.fromParts(parts.toArray(new Part[0]));

                String jsonText;
                try (Client client = clientFactory.newClient()) {
                    GenerateContentResponse response = client.models.generateContent(model, content, config);
                    logUsage("ocr.validation", model, response);
                    jsonText = response == null ? "" : response.text();
                }

                if (jsonText == null || jsonText.isBlank()) {
                    return ValidationResult.failed("Gemini validation returned empty response");
                }

                jsonText = ReceiptOcrJsonSupport.stripMarkdownFence(jsonText);
                JsonNode extracted = objectMapper.readTree(jsonText);

                boolean ok = extracted.path("ok").asBoolean(false);
                String summary = extracted.path("summary").asText("");
                List<ValidationIssue> issues = new ArrayList<>();
                JsonNode issuesNode = extracted.path("issues");
                if (issuesNode.isArray()) {
                    for (JsonNode issue : issuesNode) {
                        issues.add(new ValidationIssue(
                                issue.path("rowIndex").asInt(-1),
                                issue.path("field").asText(""),
                                issue.path("problem").asText(""),
                                issue.path("suggestion").asText("")
                        ));
                    }
                }

                return new ValidationResult(true, ok, summary, issues, Map.of());
            } catch (Exception ex) {
                if (attempt >= maxAttempts) {
                    String message = ex instanceof java.net.SocketTimeoutException
                            ? "Gemini validation timed out after " + readTimeoutMs + "ms"
                            : "Gemini validation failed: " + ex.getMessage();
                    return ValidationResult.failed(message);
                }
            }
        }
        return ValidationResult.failed("Gemini validation failed: retries exhausted");
    }

    private static Map<String, Object> buildValidationInput(ReceiptExtraction extraction) {
        Map<String, Object> agency = Map.of(
                "name", extraction.agency().name(),
                "gstin", extraction.agency().gstin(),
                "phone", extraction.agency().phone(),
                "address", extraction.agency().address()
        );
        Map<String, Object> bill = Map.of(
                "invoice_no", extraction.bill().invoiceNo(),
                "bill_number", extraction.bill().billNumber(),
                "invoice_date", extraction.bill().invoiceDate(),
                "bill_total", extraction.bill().billTotal()
        );

        List<Map<String, Object>> rows = new ArrayList<>();
        for (InventoryRow row : extraction.rows()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("product", row.name());
            entry.put("hsn", row.hsn());
            entry.put("mfr", row.manufacturer());
            entry.put("pack", row.pack());
            entry.put("qty_fr", row.qtyFr());
            entry.put("bonus", row.bonusText());
            entry.put("batch", row.batch());
            entry.put("exp", row.expiry());
            entry.put("mrp", row.mrp());
            entry.put("rate", row.rate());
            entry.put("gst", row.gst());
            entry.put("dis1", row.dis1());
            entry.put("dis2", row.dis2());
            entry.put("amount", row.amount());
            rows.add(entry);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("agency", agency);
        payload.put("bill", bill);
        payload.put("rows", rows);
        return payload;
    }

    private static String validationPrompt() {
        return "Validate JSON rows (no re-extract). Output ONLY JSON: " +
                "{\"ok\":boolean,\"issues\":[{\"rowIndex\":number,\"field\":string,\"problem\":string,\"suggestion\":string}],\"summary\":string}. " +
                "Rules: product has letters; pharma tokens if present (MG/ML/TAB/CAP/INJ/SYR/SUSP/GEL/DROP/SPRAY). " +
                "Qty >0. If rate & qty then rate*qty ~= amount (5%). " +
                "GST/discount not inside product text. Product not starting with number. ok=false if issues.";
    }

    private static String normalizeModelName(String model) {
        String resolved = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        if (resolved.startsWith("models/")) {
            resolved = resolved.substring("models/".length());
        }
        return resolved;
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

    record ValidationIssue(int rowIndex, String field, String problem, String suggestion) {}

    record ValidationResult(boolean called, boolean ok, String summary, List<ValidationIssue> issues, Map<String, Object> usage) {
        static ValidationResult skipped() {
            return new ValidationResult(false, true, "validation skipped", List.of(), Map.of());
        }

        static ValidationResult failed(String summary) {
            return new ValidationResult(true, false, summary, List.of(), Map.of());
        }
    }
}
