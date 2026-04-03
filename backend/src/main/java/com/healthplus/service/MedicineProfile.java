package com.healthplus.service;

record MedicineProfile(String category, String type, String description, String uses, String doses, String source) {
    boolean isComplete() {
        return !isUnknown(category) && !isUnknown(type) && !isUnknown(description) && !isUnknown(uses) && !isUnknown(doses);
    }

    MedicineProfile mergeMissing(MedicineProfile fallback) {
        return new MedicineProfile(
                pick(category, fallback.category()),
                pick(type, fallback.type()),
                pick(description, fallback.description()),
                pick(uses, fallback.uses()),
                pick(doses, fallback.doses()),
                resolveSource(source, fallback.source())
        );
    }

    static MedicineProfile unknown(String source) {
        return new MedicineProfile("Inventory Intake", "unknown", "Added from agency receipt OCR ingestion", "unknown", "unknown", source);
    }

    private static String pick(String primary, String fallback) {
        return isUnknown(primary) ? fallback : primary;
    }

    private static boolean isUnknown(String value) {
        if (value == null) {
            return true;
        }
        String normalized = value.trim().toLowerCase(java.util.Locale.ROOT);
        return normalized.isBlank() || "unknown".equals(normalized) || "null".equals(normalized) || "n/a".equals(normalized);
    }

    private static String resolveSource(String primary, String fallback) {
        if (primary != null && !primary.isBlank() && !"fallback".equalsIgnoreCase(primary)) {
            return primary;
        }
        return fallback == null || fallback.isBlank() ? "fallback" : fallback;
    }
}
