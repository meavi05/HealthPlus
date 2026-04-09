package com.healthplus.service;

import java.util.Locale;
import java.util.Set;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class InventoryQuantityUtils {
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)");
    private static final Pattern INTEGER_PATTERN = Pattern.compile("(\\d+)");
    private static final Pattern MULTIPLIER_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*[X*]\\s*(\\d+(?:\\.\\d+)?)");
    private static final Pattern ALPHA_PATTERN = Pattern.compile("[A-Z]+");

    private static final Set<String> TAB_TOKENS = Set.of("TAB", "TABS", "TABLET", "TABLETS");
    private static final Set<String> CAP_TOKENS = Set.of("CAP", "CAPS", "CAPSULE", "CAPSULES");
    private static final Set<String> ML_TOKENS = Set.of("ML", "MILLILITER", "MILLILITERS", "MILLILITRE", "MILLILITRES");
    private static final Set<String> L_TOKENS = Set.of("L", "LTR", "LITRE", "LITER", "LITRES", "LITERS");
    private static final Set<String> GM_TOKENS = Set.of("G", "GM", "GRAM", "GRAMS");
    private static final Set<String> KG_TOKENS = Set.of("KG", "KILOGRAM", "KILOGRAMS");
    private static final Set<String> MG_TOKENS = Set.of("MG", "MILLIGRAM", "MILLIGRAMS");

    private static final Set<String> STRIP_TOKENS = Set.of("STRIP", "STRIPS", "BLISTER", "BLISTERS");
    private static final Set<String> BOX_TOKENS = Set.of("BOX", "BOXES", "CARTON", "CASE", "KIT");
    private static final Set<String> BOTTLE_TOKENS = Set.of("BOTTLE", "BOTTLES");
    private static final Set<String> VIAL_TOKENS = Set.of("VIAL", "VIALS");
    private static final Set<String> AMPULE_TOKENS = Set.of("AMP", "AMPS", "AMPOULE", "AMPOULES", "AMPULE", "AMPULES");
    private static final Set<String> TUBE_TOKENS = Set.of("TUBE", "TUBES");
    private static final Set<String> SACHET_TOKENS = Set.of("SACHET", "SACHETS");
    private static final Set<String> JAR_TOKENS = Set.of("JAR", "JARS");
    private static final Set<String> POUCH_TOKENS = Set.of("POUCH", "POUCHES");
    private static final Set<String> PACK_TOKENS = Set.of("PACK", "PACKS");

    public record PackInfo(
            int packSize,
            String baseUom,
            String packUom,
            String purchaseUom,
            boolean ambiguous,
            String reason
    ) {}

    private InventoryQuantityUtils() {}

    public static int parsePackSize(String packText) {
        return parsePackInfo(packText).packSize();
    }

    public static PackInfo parsePackInfo(String packText) {
        String value = packText == null ? "" : packText.trim().toUpperCase(Locale.ROOT);
        String compact = value.replaceAll("\\s+", "");
        if (compact.isBlank()) {
            return new PackInfo(1, "UNIT", "UNIT", "UNIT", true, "Pack is blank");
        }

        Set<String> tokens = ALPHA_PATTERN.matcher(compact)
                .results()
                .map(MatchResult::group)
                .collect(java.util.stream.Collectors.toSet());

        boolean hasAlpha = !tokens.isEmpty();
        String baseUom = detectBaseUom(tokens);
        String explicitPackUom = detectPackUom(tokens);
        Matcher multiplierMatcher = MULTIPLIER_PATTERN.matcher(compact);

        int packSize = 1;
        boolean ambiguous = false;
        String reason = "";

        if (multiplierMatcher.find()) {
            int first = toPositiveInt(multiplierMatcher.group(1));
            int second = toPositiveInt(multiplierMatcher.group(2));
            if (first <= 0 || second <= 0) {
                ambiguous = true;
                reason = "Pack multiplier is invalid";
            } else if (first == 1) {
                packSize = second;
            } else if (!hasAlpha) {
                packSize = second;
                ambiguous = true;
                reason = "Pack has multiple factors without unit context (example: 10x10)";
            } else {
                packSize = Math.max(1, first * second);
                if (explicitPackUom.isBlank()) {
                    explicitPackUom = "PACK";
                }
            }
            if (!hasAlpha) {
                baseUom = "TAB";
            }
        } else {
            double firstNumeric = firstPositiveNumber(compact);
            if (firstNumeric <= 0) {
                ambiguous = true;
                reason = "Pack must include a numeric quantity";
                packSize = 1;
            } else {
                packSize = convertToBaseSize(firstNumeric, tokens, baseUom);
            }
            if (!hasAlpha) {
                ambiguous = true;
                reason = "Pack is numeric without unit context";
            }
        }

        if (packSize <= 0) {
            packSize = 1;
            ambiguous = true;
            reason = reason.isBlank() ? "Pack size could not be resolved" : reason;
        }

        String packUom = explicitPackUom;
        if (packUom.isBlank()) {
            packUom = defaultPackUom(baseUom, packSize);
        }
        String purchaseUom = packUom;
        return new PackInfo(packSize, baseUom, packUom, purchaseUom, ambiguous, reason);
    }

    public static String packUomFromPackSize(int packSize) {
        return Math.max(1, packSize) > 1 ? "STRIP" : "UNIT";
    }

    public static String baseUomFromPackSize(int packSize) {
        return Math.max(1, packSize) > 1 ? "TAB" : "UNIT";
    }

    public static int toBaseUnits(int enteredQty, int packSize) {
        int safeEntered = Math.max(0, enteredQty);
        int safePackSize = Math.max(1, packSize);
        if (safeEntered == 0) {
            return 0;
        }
        return safeEntered * safePackSize;
    }

    public static int toBaseUnits(int enteredQty, String packText) {
        return toBaseUnits(enteredQty, parsePackSize(packText));
    }

    public static int parseQtyFrPrimary(String qtyFr) {
        if (qtyFr == null || qtyFr.isBlank()) {
            return 0;
        }
        String value = qtyFr.trim().toLowerCase(Locale.ROOT);
        String primary = value;
        if (value.contains("+")) {
            primary = value.substring(0, value.indexOf('+'));
        } else if (value.contains("/")) {
            primary = value.substring(0, value.indexOf('/'));
        }
        return parseIntegerToken(primary);
    }

    public static int parseQtyFrBonus(String qtyFr) {
        if (qtyFr == null || qtyFr.isBlank()) {
            return 0;
        }
        String value = qtyFr.trim().toLowerCase(Locale.ROOT);
        String bonusPart = "";
        if (value.contains("+")) {
            bonusPart = value.substring(value.indexOf('+') + 1);
        } else if (value.contains("/")) {
            bonusPart = value.substring(value.indexOf('/') + 1);
        }
        return parseIntegerToken(bonusPart);
    }

    public static String purchaseUomFromPackSize(int packSize) {
        return packUomFromPackSize(packSize);
    }

    private static String detectBaseUom(Set<String> tokens) {
        if (containsAny(tokens, TAB_TOKENS)) {
            return "TAB";
        }
        if (containsAny(tokens, CAP_TOKENS)) {
            return "CAP";
        }
        if (containsAny(tokens, ML_TOKENS) || containsAny(tokens, L_TOKENS)) {
            return "ML";
        }
        if (containsAny(tokens, GM_TOKENS) || containsAny(tokens, KG_TOKENS)) {
            return "GM";
        }
        if (containsAny(tokens, MG_TOKENS)) {
            return "MG";
        }
        return "UNIT";
    }

    private static String detectPackUom(Set<String> tokens) {
        if (containsAny(tokens, STRIP_TOKENS)) {
            return "STRIP";
        }
        if (containsAny(tokens, BOX_TOKENS)) {
            return "BOX";
        }
        if (containsAny(tokens, BOTTLE_TOKENS)) {
            return "BOTTLE";
        }
        if (containsAny(tokens, VIAL_TOKENS)) {
            return "VIAL";
        }
        if (containsAny(tokens, AMPULE_TOKENS)) {
            return "AMPULE";
        }
        if (containsAny(tokens, TUBE_TOKENS)) {
            return "TUBE";
        }
        if (containsAny(tokens, SACHET_TOKENS)) {
            return "SACHET";
        }
        if (containsAny(tokens, JAR_TOKENS)) {
            return "JAR";
        }
        if (containsAny(tokens, POUCH_TOKENS)) {
            return "POUCH";
        }
        if (containsAny(tokens, PACK_TOKENS)) {
            return "PACK";
        }
        return "";
    }

    private static String defaultPackUom(String baseUom, int packSize) {
        if (packSize <= 1) {
            return "UNIT";
        }
        if ("TAB".equals(baseUom) || "CAP".equals(baseUom)) {
            return "STRIP";
        }
        if ("ML".equals(baseUom) || "GM".equals(baseUom) || "MG".equals(baseUom)) {
            return "UNIT";
        }
        return "PACK";
    }

    private static int convertToBaseSize(double numericValue, Set<String> tokens, String baseUom) {
        double scaled = numericValue;
        if ("ML".equals(baseUom) && containsAny(tokens, L_TOKENS)) {
            scaled = numericValue * 1000.0;
        } else if ("GM".equals(baseUom) && containsAny(tokens, KG_TOKENS)) {
            scaled = numericValue * 1000.0;
        }
        int parsed = (int) Math.round(scaled);
        return Math.max(1, parsed);
    }

    private static double firstPositiveNumber(String value) {
        Matcher matcher = NUMBER_PATTERN.matcher(value == null ? "" : value);
        while (matcher.find()) {
            try {
                double parsed = Double.parseDouble(matcher.group(1));
                if (parsed > 0) {
                    return parsed;
                }
            } catch (Exception ignored) {
                // no-op
            }
        }
        return -1;
    }

    private static int toPositiveInt(String value) {
        try {
            double parsed = Double.parseDouble(value);
            if (parsed <= 0) {
                return 0;
            }
            return (int) Math.round(parsed);
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static boolean containsAny(Set<String> haystack, Set<String> needles) {
        for (String token : haystack) {
            if (needles.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private static int parseIntegerToken(String value) {
        Matcher matcher = INTEGER_PATTERN.matcher(value == null ? "" : value);
        if (!matcher.find()) {
            return 0;
        }
        String digits = matcher.group(1);
        if (digits.isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(digits);
        } catch (Exception ignored) {
            return 0;
        }
    }
}
