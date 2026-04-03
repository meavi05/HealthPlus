package com.healthplus.service;

import java.util.List;
import java.util.Locale;

final class ReceiptOcrUtils {
    private static final java.util.regex.Pattern DEAL_RATE_PATTERN = java.util.regex.Pattern.compile("(?i)\\brate\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)");
    private static final java.util.regex.Pattern DEAL_QTY_PATTERN = java.util.regex.Pattern.compile("(\\d+)\\s*[+/]\\s*(\\d+)");
    private static final java.util.regex.Pattern DEAL_TEXT_PATTERN = java.util.regex.Pattern.compile("(?i)\\b(deal|scheme|offer|lot|actual\\s*rate)\\b[:\\-\\s]*([A-Za-z0-9+./=\\s-]+)");
    private static final java.util.regex.Pattern PACK_NUMBER_PATTERN = java.util.regex.Pattern.compile("(\\d+)");

    private ReceiptOcrUtils() {}

    static int parseQuantity(String value) {
        try {
            return Math.max(0, (int) Math.round(Double.parseDouble(value.replaceAll("[^0-9.]", ""))));
        } catch (Exception ignored) {
            return 0;
        }
    }

    static double parsePrice(String value) {
        try {
            return Math.max(0, Double.parseDouble(value.replaceAll("[^0-9.]", "")));
        } catch (Exception ignored) {
            return 0;
        }
    }

    static int parseQtyFr(String value) {
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

    static int parseBonusFromQtyFr(String value) {
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

    static String normalizeQtyFr(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        normalized = normalized.replaceAll("[^0-9+/]", "");
        normalized = normalized.replaceAll("\\++", "+").replaceAll("/+", "/");
        normalized = normalized.replaceAll("^[+/]+", "").replaceAll("[+/]+$", "");
        return normalized;
    }

    static int parsePackSize(String pack) {
        String value = pack == null ? "" : pack.trim().toUpperCase(Locale.ROOT);
        if (value.isBlank()) {
            return 1;
        }
        java.util.regex.Matcher matcher = PACK_NUMBER_PATTERN.matcher(value);
        java.util.List<Integer> numbers = new java.util.ArrayList<>();
        while (matcher.find()) {
            try {
                numbers.add(Integer.parseInt(matcher.group(1)));
            } catch (Exception ignored) {
                // Ignore malformed token and continue.
            }
        }
        if (numbers.isEmpty()) {
            return 1;
        }
        if (value.contains("X")) {
            return Math.max(1, numbers.get(numbers.size() - 1));
        }
        return Math.max(1, numbers.get(0));
    }

    static int toSmallestUnits(int quantity, String pack) {
        int safeQty = Math.max(0, quantity);
        int packSize = Math.max(1, parsePackSize(pack));
        if (safeQty == 0) {
            return 0;
        }
        return safeQty * packSize;
    }

    static String normalizeBonusText(String bonusText, String qtyFr) {
        String trimmed = bonusText == null ? "" : bonusText.trim();
        if (!trimmed.isBlank()) {
            return trimmed;
        }
        if (qtyFr == null) {
            return "";
        }
        String fallback = qtyFr.trim();
        if (fallback.contains("+") || fallback.contains("/")) {
            return fallback;
        }
        return "";
    }

    static String truncateForDebug(String input, int maxChars) {
        if (input == null) {
            return "";
        }
        if (input.length() <= maxChars) {
            return input;
        }
        return input.substring(0, Math.max(0, maxChars)) + "\n...[truncated]";
    }

    static boolean isImageOrPdf(String fileName, String contentType) {
        String safeType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String safeName = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        return safeType.contains("pdf")
                || safeType.startsWith("image/")
                || safeName.endsWith(".pdf")
                || safeName.endsWith(".png")
                || safeName.endsWith(".jpg")
                || safeName.endsWith(".jpeg")
                || safeName.endsWith(".webp");
    }

    static String extractDealText(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.isBlank()) {
            return "";
        }
        var matcher = DEAL_TEXT_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            return matcher.group().trim();
        }
        var qtyMatcher = DEAL_QTY_PATTERN.matcher(trimmed);
        if (qtyMatcher.find()) {
            return "Deal " + qtyMatcher.group().replaceAll("\\s+", "");
        }
        var rateMatcher = DEAL_RATE_PATTERN.matcher(trimmed);
        if (rateMatcher.find()) {
            return "Deal Rate=" + rateMatcher.group(1);
        }
        return "";
    }

    static double computeEffectiveCostPrice(double rate,
                                            double mrp,
                                            double gst,
                                            double dis1,
                                            double dis2,
                                            String qtyFr,
                                            String bonusText,
                                            String deal,
                                            int quantityAdded,
                                            int bonusQty) {
        double baseRate = rate > 0 ? rate : mrp;
        if (baseRate <= 0) {
            return 0;
        }

        int paidQty = quantityAdded > 0 ? quantityAdded : parseQtyFr(qtyFr);
        int ratioPaidQty = 0;
        int bonusQtyResolved = bonusQty;

        String qtyCandidate = qtyFr == null ? "" : qtyFr.trim();
        int[] qtyPair = extractQtyBonusPair(qtyCandidate);
        if (qtyPair[0] > 0 && qtyPair[1] > 0) {
            ratioPaidQty = qtyPair[0];
            bonusQtyResolved = Math.max(bonusQtyResolved, qtyPair[1]);
        } else if (!qtyCandidate.isBlank() && (qtyCandidate.contains("+") || qtyCandidate.contains("/"))) {
            ratioPaidQty = parseQtyFr(qtyCandidate);
            bonusQtyResolved = Math.max(bonusQtyResolved, parseBonusFromQtyFr(qtyCandidate));
        }

        String bonusCandidate = bonusText == null ? "" : bonusText.trim();
        if ((bonusQtyResolved <= 0 || ratioPaidQty <= 0)
                && !bonusCandidate.isBlank()
                && (bonusCandidate.contains("+") || bonusCandidate.contains("/"))) {
            int[] bonusPair = extractQtyBonusPair(bonusCandidate);
            if (bonusPair[0] > 0 && bonusPair[1] > 0) {
                ratioPaidQty = bonusPair[0];
                bonusQtyResolved = Math.max(bonusQtyResolved, bonusPair[1]);
            } else if (ratioPaidQty <= 0) {
                ratioPaidQty = parseQtyFr(bonusCandidate);
            }
            if (bonusPair[0] <= 0 || bonusPair[1] <= 0) {
                bonusQtyResolved = Math.max(bonusQtyResolved, parseBonusFromQtyFr(bonusCandidate));
            }
        }

        String dealCandidate = deal == null ? "" : deal.trim();
        if ((bonusQtyResolved <= 0 || ratioPaidQty <= 0)
                && !dealCandidate.isBlank()
                && (dealCandidate.contains("+") || dealCandidate.contains("/"))) {
            int[] dealPair = extractQtyBonusPair(dealCandidate);
            if (dealPair[0] > 0 && dealPair[1] > 0) {
                ratioPaidQty = dealPair[0];
                bonusQtyResolved = Math.max(bonusQtyResolved, dealPair[1]);
            } else if (ratioPaidQty <= 0) {
                ratioPaidQty = parseQtyFr(dealCandidate);
            }
            if (dealPair[0] <= 0 || dealPair[1] <= 0) {
                bonusQtyResolved = Math.max(bonusQtyResolved, parseBonusFromQtyFr(dealCandidate));
            }
        }

        if (ratioPaidQty > 0 && paidQty <= 0) {
            paidQty = ratioPaidQty;
        }
        if (paidQty <= 0) {
            return 0;
        }

        double adjustmentMultiplier = (1 + (gst / 100.0))
                * (1 - (dis1 / 100.0))
                * (1 - (dis2 / 100.0));
        double adjustedRate = Math.max(0, baseRate * adjustmentMultiplier);

        if (bonusQtyResolved > 0) {
            int ratioBase = ratioPaidQty > 0 ? ratioPaidQty : paidQty;
            if (ratioBase > 0) {
                double bonusRatio = bonusQtyResolved / (double) ratioBase;
                double earnedBonus = paidQty * bonusRatio;
                double denominator = paidQty + earnedBonus;
                if (denominator > 0) {
                    return Math.max(0, adjustedRate * (paidQty / denominator));
                }
            }
        }

        return adjustedRate;
    }

    private static int[] extractQtyBonusPair(String value) {
        if (value == null || value.isBlank()) {
            return new int[]{0, 0};
        }
        var matcher = DEAL_QTY_PATTERN.matcher(value);
        if (matcher.find()) {
            int paid = parseQuantity(matcher.group(1));
            int bonus = parseQuantity(matcher.group(2));
            return new int[]{paid, bonus};
        }
        return new int[]{0, 0};
    }

}
