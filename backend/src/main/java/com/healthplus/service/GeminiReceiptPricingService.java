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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
class GeminiReceiptPricingService {
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";
    private static final Logger log = LoggerFactory.getLogger(GeminiReceiptPricingService.class);
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final String model;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final int maxAttempts;
    private final VertexAiClientFactory clientFactory;

    GeminiReceiptPricingService(ObjectMapper objectMapper,
                                @Value("${app.ocr.pricing.enabled:true}") boolean enabled,
                                @Value("${app.ocr.pricing.model:}") String model,
                                @Value("${app.ocr.pricing.connect-timeout-ms:15000}") int connectTimeoutMs,
                                @Value("${app.ocr.pricing.read-timeout-ms:45000}") int readTimeoutMs,
                                @Value("${app.ocr.pricing.max-attempts:2}") int maxAttempts,
                                VertexAiClientFactory clientFactory) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.model = normalizeModelName(model);
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.clientFactory = clientFactory;
    }

    PricingResult priceRows(List<InventoryRow> rows) {
        if (!enabled || rows == null || rows.isEmpty()) {
            return PricingResult.skipped();
        }
        if (!clientFactory.isEnabled()) {
            return PricingResult.skipped();
        }

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                Map<String, Object> input = buildPricingInput(rows);
                String payloadText = objectMapper.writeValueAsString(input);

                GenerateContentConfig config = GenerateContentConfig.builder()
                        .systemInstruction(Content.fromParts(Part.fromText(pricingPrompt())))
                        .build();
                Content content = Content.fromParts(Part.fromText(payloadText));

                String jsonText;
                try (Client client = clientFactory.newClient()) {
                    GenerateContentResponse response = client.models.generateContent(model, content, config);
                    logUsage("ocr.pricing", model, response);
                    jsonText = response == null ? "" : response.text();
                }

                if (jsonText == null || jsonText.isBlank()) {
                    return PricingResult.failed("Gemini pricing returned empty response");
                }

                jsonText = ReceiptOcrJsonSupport.stripMarkdownFence(jsonText);
                JsonNode extracted = objectMapper.readTree(jsonText);

                boolean ok = extracted.path("ok").asBoolean(true);
                String summary = extracted.path("summary").asText("");
                Map<Integer, Double> costs = new LinkedHashMap<>();
                JsonNode rowsNode = extracted.path("rows");
                if (rowsNode.isArray()) {
                    for (JsonNode rowNode : rowsNode) {
                        int index = rowNode.path("index").asInt(-1);
                        double cost = ReceiptOcrUtils.parsePrice(rowNode.path("effective_unit_cost").asText(""));
                        if (index >= 0) {
                            costs.put(index, cost);
                        }
                    }
                }

                return new PricingResult(true, ok, summary, costs, Map.of());
            } catch (Exception ex) {
                if (attempt >= maxAttempts) {
                    String message = ex instanceof java.net.SocketTimeoutException
                            ? "Gemini pricing timed out after " + readTimeoutMs + "ms"
                            : "Gemini pricing failed: " + ex.getMessage();
                    return PricingResult.failed(message);
                }
            }
        }
        return PricingResult.failed("Gemini pricing failed: retries exhausted");
    }

    private static Map<String, Object> buildPricingInput(List<InventoryRow> rows) {
        List<Map<String, Object>> payloadRows = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            InventoryRow row = rows.get(i);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("index", i);
            entry.put("product", row.name());
            entry.put("qty_fr", row.qtyFr());
            entry.put("mrp", row.mrp());
            entry.put("rate", row.rate());
            entry.put("gst", row.gst());
            entry.put("dis1", row.dis1());
            entry.put("dis2", row.dis2());
            entry.put("amount", row.amount());
            payloadRows.add(entry);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rows", payloadRows);
        return payload;
    }

    private static String pricingPrompt() {
        return "Compute effective_unit_cost per row. Inputs: qty_fr, mrp, rate, gst, dis1, dis2, amount. " +
                "Ignore bonus/deal/free quantities. paid_qty = qty_fr before +/. " +
                "base_rate = rate>0 else mrp>0 else amount/paid_qty. " +
                "net = base_rate*(1-dis1/100)*(1-dis2/100); net_gst = net*(1+gst/100). " +
                "Round 2 decimals. " +
                "Return ONLY JSON: {\"ok\":boolean,\"summary\":string,\"rows\":[{\"index\":number,\"effective_unit_cost\":number,\"notes\":string}]}";
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
            log.info("VertexAI token usage operation={} model={} prompt_tokens={} candidates_tokens={} total_tokens={} cached_tokens={} thoughts_tokens={} tool_prompt_tokens={}",
                    operation, model, promptTokens, candidatesTokens, totalTokens, cachedTokens, thoughtsTokens, toolPromptTokens);
        });
    }

    record PricingResult(boolean called, boolean ok, String summary, Map<Integer, Double> effectiveCosts, Map<String, Object> usage) {
        static PricingResult skipped() {
            return new PricingResult(false, true, "pricing skipped", Map.of(), Map.of());
        }

        static PricingResult failed(String summary) {
            return new PricingResult(true, false, summary, Map.of(), Map.of());
        }
    }
}
