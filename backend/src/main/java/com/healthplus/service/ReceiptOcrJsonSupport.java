package com.healthplus.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

final class ReceiptOcrJsonSupport {
    private ReceiptOcrJsonSupport() {}

    static List<InventoryRow> parseItems(JsonNode items) {
        if (items == null || !items.isArray()) {
            return List.of();
        }
        List<InventoryRow> rows = new ArrayList<>();
        for (JsonNode item : items) {
            String product = textOf(item, "product", "name");
            String hsn = textOf(item, "hsn");
            String mfr = textOf(item, "mfr", "manufacturer", "brand");
            String pack = textOf(item, "pack");
            String qtyFr = textOf(item, "qty_fr", "qty_plus_fr", "quantity_fr");
            String bonusText = textOf(item, "bonus", "free_qty", "free");
            String batch = textOf(item, "batch");
            String exp = textOf(item, "exp", "expiry");
            double mrp = numberOf(item, "mrp");
            double rate = numberOf(item, "rate", "unit_price");
            double gst = numberOf(item, "gst", "gst_percent", "gst_percentage");
            double dis1 = numberOf(item, "dis1");
            double dis2 = numberOf(item, "dis2");
            double amount = numberOf(item, "amount");
            String deal = textOf(item, "deal", "scheme", "offer", "lot");
            double effectiveCostPrice = numberOf(item, "effective_cost_price", "effective_unit_price", "effective_unit_rate");
            String medicineCategory = textOf(item, "medicine_category", "category");
            String medicineType = textOf(item, "medicine_type", "type");
            String medicineDescription = textOf(item, "medicine_description", "description");
            String medicineUses = textOf(item, "medicine_uses", "uses");
            String medicineDoses = textOf(item, "medicine_doses", "doses");

            int legacyQuantity = ReceiptOcrUtils.parseQuantity(item.path("quantity").asText("0"));
            if (qtyFr.isBlank() && legacyQuantity > 0) {
                qtyFr = String.valueOf(legacyQuantity);
            }
            bonusText = ReceiptOcrUtils.normalizeBonusText(bonusText, qtyFr);
            int quantityAdded = ReceiptOcrUtils.parseQtyFr(qtyFr);
            int bonusQty = ReceiptOcrUtils.parseBonusFromQtyFr(qtyFr);

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
            InventoryRow row = new InventoryRow(product, hsn, mfr, pack, qtyFr, bonusText, quantityAdded, bonusQty, batch, exp, mrp, rate, gst, dis1, dis2, amount, deal, effectiveCostPrice,
                    medicineCategory, medicineType, medicineDescription, medicineUses, medicineDoses);
            if (row.name().isBlank() || row.quantity() <= 0 || !row.hasPricingEvidence()) {
                continue;
            }
            rows.add(row);
        }
        return rows;
    }

    static String stripMarkdownFence(String input) {
        String trimmed = input == null ? "" : input.trim();
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

    static String textOf(JsonNode node, String... keys) {
        if (node == null) {
            return "";
        }
        for (String key : keys) {
            String value = node.path(key).asText("");
            if (!value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    static double numberOf(JsonNode node, String... keys) {
        if (node == null) {
            return 0;
        }
        for (String key : keys) {
            JsonNode valueNode = node.path(key);
            if (!valueNode.isMissingNode() && !valueNode.isNull()) {
                double value = ReceiptOcrUtils.parsePrice(valueNode.asText(""));
                if (value > 0) {
                    return value;
                }
            }
        }
        return 0;
    }
}
