package com.healthplus.service;

import java.util.List;
import java.util.Map;

record ReceiptAgency(String name, String gstin, String dlNo, String phone, String address) {}

record ReceiptBill(String invoiceNo, String billNumber, String invoiceDate, double billTotal) {}

record ParsedReceiptText(ReceiptAgency agency, ReceiptBill bill, List<InventoryRow> rows) {}

record LocalExtractionAssessment(double confidence, double ambiguousRatio, boolean shouldFallbackToGemini) {}

record ReceiptExtraction(ReceiptAgency agency, ReceiptBill bill, List<InventoryRow> rows, String source, Map<String, Object> extractionMeta) {}

record OcrAttempt(ReceiptExtraction extraction, Map<String, Object> step, boolean accepted) {}

record InventoryRow(
        String product,
        String hsn,
        String manufacturer,
        String pack,
        String qtyFr,
        String bonusText,
        int quantityAdded,
        int bonusQty,
        String batch,
        String expiry,
        double mrp,
        double rate,
        double gst,
        double dis1,
        double dis2,
        double amount,
        String deal,
        double effectiveCostPrice,
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

    public String bonusText() {
        return bonusText == null ? "" : bonusText.trim();
    }

    int quantity() {
        if (quantityAdded > 0) {
            return quantityAdded;
        }
        int qty = ReceiptOcrUtils.parseQtyFr(qtyFr);
        if (qty > 0) {
            return qty;
        }
        double inferredRate = rate;
        if (amount > 0 && inferredRate > 0) {
            return Math.max(1, (int) Math.round(amount / inferredRate));
        }
        return 0;
    }

    public double effectiveCostPrice() {
        return Math.max(0, effectiveCostPrice);
    }

    public String deal() {
        return deal == null ? "" : deal.trim();
    }

    boolean hasPricingEvidence() {
        return effectiveCostPrice > 0 || rate > 0 || mrp > 0 || amount > 0;
    }

    InventoryRow withDeal(String updatedDeal) {
        return new InventoryRow(product, hsn, manufacturer, pack, qtyFr, bonusText, quantityAdded, bonusQty, batch, expiry, mrp, rate, gst, dis1, dis2, amount,
                updatedDeal, effectiveCostPrice, medicineCategory, medicineType, medicineDescription, medicineUses, medicineDoses);
    }

    InventoryRow withEffectiveCost(double updatedCost) {
        return new InventoryRow(product, hsn, manufacturer, pack, qtyFr, bonusText, quantityAdded, bonusQty, batch, expiry, mrp, rate, gst, dis1, dis2, amount,
                deal, updatedCost, medicineCategory, medicineType, medicineDescription, medicineUses, medicineDoses);
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
