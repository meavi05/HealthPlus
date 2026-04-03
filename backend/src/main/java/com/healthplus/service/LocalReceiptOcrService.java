package com.healthplus.service;

import jakarta.annotation.PostConstruct;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
class LocalReceiptOcrService {
    private static final Logger log = LoggerFactory.getLogger(LocalReceiptOcrService.class);
    private static final List<String> DEFAULT_TESSDATA_DIRS = List.of(
            "/opt/homebrew/share/tessdata",
            "/usr/local/share/tessdata",
            "/usr/share/tessdata"
    );

    @Value("${app.ocr.local.enabled:true}")
    private boolean localOcrEnabled;
    @Value("${app.ocr.local.language:eng}")
    private String localOcrLanguage;
    @Value("${app.ocr.local.tessdata-path:}")
    private String localOcrTessdataPath;
    @Value("${app.ocr.local.psm:6}")
    private int localOcrPsm;
    @Value("${app.ocr.local.oem:3}")
    private int localOcrOem;
    @Value("${app.ocr.local.debug:false}")
    private boolean localOcrDebug;
    @Value("${app.ocr.local.pdf-dpi:300}")
    private int localPdfDpi;
    @Value("${app.ocr.local.min-confidence:0.75}")
    private double localOcrMinConfidence;
    @Value("${app.ocr.local.max-ambiguous-ratio:0.35}")
    private double localOcrMaxAmbiguousRatio;
    @Value("${app.ocr.local.auto-rotate.enabled:true}")
    private boolean localOcrAutoRotateEnabled;
    @Value("${app.ocr.local.auto-rotate.max-side:1100}")
    private int localOcrAutoRotateMaxSide;
    @Value("${app.ocr.local.auto-rotate.psm:6}")
    private int localOcrAutoRotatePsm;
    @Value("${app.ocr.local.auto-rotate.min-score:30}")
    private int localOcrAutoRotateMinScore;
    @Value("${app.ocr.local.row-ocr.enabled:false}")
    private boolean localOcrRowEnabled;
    @Value("${app.ocr.local.row-ocr.min-height:18}")
    private int localOcrRowMinHeight;
    @Value("${app.ocr.local.row-ocr.max-gap:6}")
    private int localOcrRowMaxGap;
    @Value("${app.ocr.local.row-ocr.black-ratio:0.01}")
    private double localOcrRowBlackRatio;
    @Value("${app.ocr.local.row-ocr.psm:7}")
    private int localOcrRowPsm;
    @Value("${app.ocr.local.row-ocr.min-rows:3}")
    private int localOcrRowMinRows;

    @PostConstruct
    void logOcrRuntimeConfig() {
        ensureTesseractLibraryPath();
        String jnaPath = System.getProperty("jna.library.path", "");
        String language = (localOcrLanguage == null || localOcrLanguage.isBlank()) ? "eng" : localOcrLanguage.trim();
        Path tessdataDir = resolveTessdataDir(language);
        Path dylibPath = Path.of("/opt/homebrew/lib/libtesseract.dylib");
        log.info(
                "OCR native config: localEnabled={}, debug={}, psm={}, oem={}, jna.library.path='{}', libtesseractExists={}, tessdataPath='{}', language='{}', languageDataExists={}",
                localOcrEnabled,
                localOcrDebug,
                localOcrPsm,
                localOcrOem,
                jnaPath,
                Files.exists(dylibPath),
                tessdataDir == null ? "<unresolved>" : tessdataDir.toString(),
                language,
                tessdataDir != null && Files.exists(tessdataDir.resolve(language + ".traineddata"))
        );
    }

    boolean isEnabled() {
        return localOcrEnabled;
    }

    ReceiptExtraction extract(MultipartFile file) {
        if (!localOcrEnabled || file == null || file.isEmpty()) {
            return null;
        }
        try {
            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
            String text;
            String strategy;
            if (contentType.contains("pdf") || fileName.endsWith(".pdf")) {
                text = extractTextFromPdf(file.getBytes());
                strategy = "pdfbox+tess4j";
            } else {
                text = extractTextFromImage(file.getBytes());
                strategy = "tess4j";
            }
            if (text == null || text.isBlank()) {
                return null;
            }

            ParsedReceiptText parsed = parseReceiptTextWithRules(text);
            if (parsed.rows().isEmpty()) {
                return null;
            }

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("strategy", strategy);
            meta.put("gemini_calls", 0);
            meta.put("cache_hit", false);
            meta.put("raw_text_chars", text.length());
            meta.put("rule_parser_rows", parsed.rows().size());
            if (localOcrDebug) {
                meta.put("raw_text", ReceiptOcrUtils.truncateForDebug(text, 12000));
            }
            return new ReceiptExtraction(parsed.agency(), parsed.bill(), parsed.rows(), "local-ocr", meta);
        } catch (Throwable ignored) {
            return null;
        }
    }

    OcrAttempt attempt(MultipartFile file) {
        if (!localOcrEnabled || file == null || file.isEmpty()) {
            return null;
        }
        if (!ReceiptOcrUtils.isImageOrPdf(file.getOriginalFilename(), file.getContentType())) {
            return null;
        }
        ReceiptExtraction extraction = extract(file);
        if (extraction != null && !extraction.rows().isEmpty()) {
            LocalExtractionAssessment assessment = assessLocalExtraction(extraction.rows());
            Map<String, Object> details = new LinkedHashMap<>(extraction.extractionMeta());
            details.put("rows", extraction.rows().size());
            details.put("confidence", roundCurrency(assessment.confidence() * 100));
            details.put("ambiguous_ratio", roundCurrency(assessment.ambiguousRatio() * 100));
            boolean accepted = !assessment.shouldFallbackToGemini();
            Map<String, Object> step = step(
                    "local-ocr",
                    accepted ? "success" : "warning",
                    accepted ? "Local OCR accepted" : "Local OCR confidence low, escalating to Gemini",
                    details
            );
            return new OcrAttempt(extraction, step, accepted);
        }
        Map<String, Object> step = step("local-ocr", "warning", "Local OCR produced no valid rows, escalating to Gemini", Map.of("rows", 0));
        return new OcrAttempt(null, step, false);
    }

    private LocalExtractionAssessment assessLocalExtraction(List<InventoryRow> rows) {
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

    private String extractTextFromPdf(byte[] bytes) throws IOException {
        try (PDDocument document = PDDocument.load(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String extracted = stripper.getText(document);
            if (extracted != null && extracted.replaceAll("\\s+", "").length() > 120) {
                return extracted;
            }

            PDFRenderer renderer = new PDFRenderer(document);
            StringBuilder joined = new StringBuilder();
            int pages = Math.min(document.getNumberOfPages(), 5);
            for (int i = 0; i < pages; i++) {
                BufferedImage page = renderer.renderImageWithDPI(i, Math.max(150, localPdfDpi), ImageType.RGB);
                BufferedImage processed = preprocessForOcr(page);
                String pageText = runRowOcrIfEnabled(processed);
                if (pageText.isBlank()) {
                    pageText = runTesseract(processed);
                }
                if (!pageText.isBlank()) {
                    joined.append(pageText).append("\n");
                }
            }
            return joined.toString();
        }
    }

    private String extractTextFromImage(byte[] bytes) throws IOException {
        BufferedImage input = ImageIO.read(new ByteArrayInputStream(bytes));
        if (input == null) {
            return "";
        }
        BufferedImage processed = preprocessForOcr(input);
        String rowText = runRowOcrIfEnabled(processed);
        if (!rowText.isBlank()) {
            return rowText;
        }
        return runTesseract(processed);
    }

    private ParsedReceiptText parseReceiptTextWithRules(String text) {
        String[] lines = text.split("\\R");
        String agencyName = "";
        String gstin = "";
        String dlNo = "";
        String invoiceNo = "";
        String billNo = "";
        String invoiceDate = "";
        double billTotal = 0;
        List<InventoryRow> rows = new ArrayList<>();

        Pattern numberPattern = Pattern.compile("(\\d+(?:\\.\\d+)?)");
        Pattern qtyPattern = Pattern.compile("\\b\\d+\\s*(?:[+/]\\s*\\d+)?\\b");
        Pattern invoicePattern = Pattern.compile("(?i)(invoice\\s*no|inv\\s*no)\\s*[:\\-]?\\s*([A-Z0-9\\-/]+)");
        Pattern billPattern = Pattern.compile("(?i)(bill\\s*no|bill\\s*number)\\s*[:\\-]?\\s*([A-Z0-9\\-/]+)");
        Pattern datePattern = Pattern.compile("\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b");
        Pattern totalPattern = Pattern.compile("(?i)(grand\\s*total|net\\s*amount|bill\\s*total|total)\\D*(\\d+(?:\\.\\d+)?)");
        Pattern gstinPattern = Pattern.compile("\\b\\d{2}[A-Z]{5}\\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}\\b");
        Pattern dlPattern = Pattern.compile("(?i)\\bD\\.?L\\.?\\s*No\\.?\\s*[:\\-]?\\s*([A-Z0-9/\\-]+)");

        for (String raw : lines) {
            String line = raw == null ? "" : raw.trim();
            if (line.isBlank()) {
                continue;
            }
            if (agencyName.isBlank() && line.length() > 4 && line.length() < 80 && !line.matches(".*\\d{4,}.*")) {
                agencyName = line;
            }
            if (gstin.isBlank()) {
                Matcher gstMatcher = gstinPattern.matcher(line);
                if (gstMatcher.find()) {
                    gstin = gstMatcher.group();
                }
            }
            if (dlNo.isBlank()) {
                Matcher dlMatcher = dlPattern.matcher(line);
                if (dlMatcher.find()) {
                    dlNo = dlMatcher.group(1).trim();
                }
            }

            Matcher invMatcher = invoicePattern.matcher(line);
            if (invoiceNo.isBlank() && invMatcher.find()) {
                invoiceNo = invMatcher.group(2).trim();
            }
            Matcher billMatcher = billPattern.matcher(line);
            if (billNo.isBlank() && billMatcher.find()) {
                billNo = billMatcher.group(2).trim();
            }
            Matcher dateMatcher = datePattern.matcher(line);
            if (invoiceDate.isBlank() && dateMatcher.find()) {
                invoiceDate = dateMatcher.group();
            }
            Matcher totalMatcher = totalPattern.matcher(line);
            if (totalMatcher.find()) {
                billTotal = Math.max(billTotal, ReceiptOcrUtils.parsePrice(totalMatcher.group(2)));
            }

            String lower = line.toLowerCase(Locale.ROOT);
            if (lower.contains("subtotal") || lower.contains("tax") || lower.contains("cgst") || lower.contains("sgst") || lower.contains("igst")) {
                continue;
            }
            if (lower.contains("total") && !lower.contains("otrivin") && !lower.contains("tablet")) {
                continue;
            }
            if (!line.matches(".*[A-Za-z].*") || !line.matches(".*\\d.*")) {
                continue;
            }

            List<Double> numbers = new ArrayList<>();
            Matcher numberMatcher = numberPattern.matcher(line);
            while (numberMatcher.find()) {
                numbers.add(ReceiptOcrUtils.parsePrice(numberMatcher.group(1)));
            }
            if (numbers.size() < 2) {
                continue;
            }

            Matcher qtyMatcher = qtyPattern.matcher(line);
            String qtyFr = "";
            if (qtyMatcher.find()) {
                qtyFr = ReceiptOcrUtils.normalizeQtyFr(qtyMatcher.group().replaceAll("\\s+", ""));
            }

            double amount = numbers.get(numbers.size() - 1);
            double rate = numbers.get(Math.max(0, numbers.size() - 2));
            if (amount <= 0 || rate <= 0) {
                continue;
            }

            String[] tokens = line.split("\\s+");
            StringBuilder productBuilder = new StringBuilder();
            for (String token : tokens) {
                if (token.matches("\\d+(?:\\.\\d+)?")) {
                    break;
                }
                if (productBuilder.length() > 0) {
                    productBuilder.append(' ');
                }
                productBuilder.append(token);
            }
            String product = productBuilder.toString().replaceAll("^[0-9]+\\s*", "").trim();
            if (product.length() < 3) {
                continue;
            }

            String deal = ReceiptOcrUtils.extractDealText(line);
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
                    deal,
                    quantityAdded,
                    bonusQty
            );
            InventoryRow row = new InventoryRow(product, "", "", "", qtyFr, bonusText, quantityAdded, bonusQty, "", "", 0, rate, 0, 0, 0, amount, deal, effectiveCostPrice, "", "", "", "", "");
            if (row.quantity() <= 0 || !row.hasPricingEvidence()) {
                continue;
            }
            rows.add(row);
        }

        ReceiptAgency agency = new ReceiptAgency(agencyName.isBlank() ? "Unknown Agency" : agencyName, gstin, dlNo, "", "");
        ReceiptBill bill = new ReceiptBill(invoiceNo, billNo, invoiceDate, billTotal);
        return new ParsedReceiptText(agency, bill, rows);
    }

    private BufferedImage preprocessForOcr(BufferedImage source) {
        int minWidth = 1800;
        int width = source.getWidth();
        int height = source.getHeight();
        double scale = width >= minWidth ? 1.0 : (double) minWidth / Math.max(1, width);
        int scaledWidth = Math.max(1, (int) Math.round(width * scale));
        int scaledHeight = Math.max(1, (int) Math.round(height * scale));

        BufferedImage scaled = new BufferedImage(scaledWidth, scaledHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = scaled.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.drawImage(source, 0, 0, scaledWidth, scaledHeight, null);
        graphics.dispose();

        BufferedImage gray = new BufferedImage(scaledWidth, scaledHeight, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D grayGraphics = gray.createGraphics();
        grayGraphics.drawImage(scaled, 0, 0, null);
        grayGraphics.dispose();

        BufferedImage binary = new BufferedImage(scaledWidth, scaledHeight, BufferedImage.TYPE_BYTE_BINARY);
        for (int y = 0; y < scaledHeight; y++) {
            for (int x = 0; x < scaledWidth; x++) {
                int rgb = gray.getRGB(x, y);
                int luminance = (rgb >> 16) & 0xFF;
                int value = luminance > 150 ? 0xFFFFFF : 0x000000;
                binary.setRGB(x, y, value == 0xFFFFFF ? Color.WHITE.getRGB() : Color.BLACK.getRGB());
            }
        }
        return autoRotateIfEnabled(binary);
    }

    private String runTesseract(BufferedImage image) {
        return runTesseract(image, localOcrPsm);
    }

    private String runTesseract(BufferedImage image, int psmOverride) {
        ensureTesseractLibraryPath();
        String language = (localOcrLanguage == null || localOcrLanguage.isBlank()) ? "eng" : localOcrLanguage.trim();
        Path tessdataDir = resolveTessdataDir(language);
        if (tessdataDir == null) {
            return "";
        }
        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath(tessdataDir.toString());
        tesseract.setLanguage(language);
        tesseract.setPageSegMode(psmOverride);
        tesseract.setOcrEngineMode(localOcrOem);
        try {
            return tesseract.doOCR(image);
        } catch (TesseractException | UnsatisfiedLinkError ex) {
            return "";
        }
    }

    private String runRowOcrIfEnabled(BufferedImage binaryImage) {
        if (!localOcrRowEnabled) {
            return "";
        }
        List<BufferedImage> rows = splitImageIntoRows(binaryImage);
        if (rows.size() < Math.max(1, localOcrRowMinRows)) {
            return "";
        }
        StringBuilder joined = new StringBuilder();
        for (BufferedImage row : rows) {
            String rowText = runTesseract(row, localOcrRowPsm);
            if (!rowText.isBlank()) {
                joined.append(rowText.trim()).append("\n");
            }
        }
        return joined.toString().trim();
    }

    private List<BufferedImage> splitImageIntoRows(BufferedImage binaryImage) {
        int width = binaryImage.getWidth();
        int height = binaryImage.getHeight();
        if (width <= 0 || height <= 0) {
            return List.of();
        }
        double ratio = Math.max(0.002, localOcrRowBlackRatio);
        int minBlack = Math.max(4, (int) Math.round(width * ratio));
        boolean[] ink = new boolean[height];
        for (int y = 0; y < height; y++) {
            int blackCount = 0;
            for (int x = 0; x < width; x++) {
                int rgb = binaryImage.getRGB(x, y) & 0xFFFFFF;
                if (rgb == 0x000000) {
                    blackCount++;
                    if (blackCount >= minBlack) {
                        ink[y] = true;
                        break;
                    }
                }
            }
        }

        List<int[]> spans = new ArrayList<>();
        int y = 0;
        while (y < height) {
            while (y < height && !ink[y]) {
                y++;
            }
            if (y >= height) {
                break;
            }
            int start = y;
            while (y < height && ink[y]) {
                y++;
            }
            int end = y - 1;
            spans.add(new int[] {start, end});
        }

        if (spans.isEmpty()) {
            return List.of();
        }

        int maxGap = Math.max(0, localOcrRowMaxGap);
        int minHeight = Math.max(8, localOcrRowMinHeight);
        List<int[]> merged = new ArrayList<>();
        for (int[] span : spans) {
            if (merged.isEmpty()) {
                merged.add(span);
                continue;
            }
            int[] last = merged.get(merged.size() - 1);
            if (span[0] - last[1] <= maxGap) {
                last[1] = span[1];
            } else {
                merged.add(span);
            }
        }

        int pad = 2;
        List<BufferedImage> rows = new ArrayList<>();
        for (int[] span : merged) {
            int rowHeight = span[1] - span[0] + 1;
            if (rowHeight < minHeight) {
                continue;
            }
            int top = Math.max(0, span[0] - pad);
            int bottom = Math.min(height - 1, span[1] + pad);
            int cropHeight = bottom - top + 1;
            if (cropHeight < minHeight) {
                continue;
            }
            rows.add(binaryImage.getSubimage(0, top, width, cropHeight));
        }
        return rows;
    }

    private BufferedImage autoRotateIfEnabled(BufferedImage binaryImage) {
        if (!localOcrAutoRotateEnabled) {
            return binaryImage;
        }
        int[] rotations = new int[] {0, 90, 180, 270};
        int bestRotation = 0;
        int bestScore = -1;
        for (int rotation : rotations) {
            BufferedImage candidate = rotation == 0 ? binaryImage : rotateImage(binaryImage, rotation);
            BufferedImage sample = scaleToMaxSide(candidate, localOcrAutoRotateMaxSide);
            String text = runTesseract(sample, localOcrAutoRotatePsm);
            int score = scoreOcrText(text);
            if (score > bestScore) {
                bestScore = score;
                bestRotation = rotation;
            }
        }
        if (bestRotation == 0 || bestScore < localOcrAutoRotateMinScore) {
            return binaryImage;
        }
        return rotateImage(binaryImage, bestRotation);
    }

    private static int scoreOcrText(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        int letters = 0;
        int digits = 0;
        int spaces = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (Character.isLetter(ch)) {
                letters++;
            } else if (Character.isDigit(ch)) {
                digits++;
            } else if (Character.isWhitespace(ch)) {
                spaces++;
            }
        }
        return (letters * 2) + digits + Math.min(spaces, 40);
    }

    private static BufferedImage rotateImage(BufferedImage source, int degrees) {
        int width = source.getWidth();
        int height = source.getHeight();
        int normalized = ((degrees % 360) + 360) % 360;
        if (normalized == 0) {
            return source;
        }
        int targetWidth = (normalized == 180) ? width : height;
        int targetHeight = (normalized == 180) ? height : width;
        BufferedImage rotated = new BufferedImage(targetWidth, targetHeight, source.getType());
        Graphics2D graphics = rotated.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        graphics.translate(targetWidth / 2.0, targetHeight / 2.0);
        graphics.rotate(Math.toRadians(normalized));
        graphics.translate(-width / 2.0, -height / 2.0);
        graphics.drawImage(source, 0, 0, null);
        graphics.dispose();
        return rotated;
    }

    private static BufferedImage scaleToMaxSide(BufferedImage source, int maxSide) {
        if (maxSide <= 0) {
            return source;
        }
        int width = source.getWidth();
        int height = source.getHeight();
        int currentMax = Math.max(width, height);
        if (currentMax <= maxSide) {
            return source;
        }
        double scale = (double) maxSide / currentMax;
        int targetWidth = Math.max(1, (int) Math.round(width * scale));
        int targetHeight = Math.max(1, (int) Math.round(height * scale));
        BufferedImage scaled = new BufferedImage(targetWidth, targetHeight, source.getType());
        Graphics2D graphics = scaled.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        graphics.dispose();
        return scaled;
    }

    private void ensureTesseractLibraryPath() {
        String current = System.getProperty("jna.library.path");
        if (current != null && !current.isBlank()) {
            return;
        }
        Path homebrewLib = Path.of("/opt/homebrew/lib/libtesseract.dylib");
        if (Files.exists(homebrewLib)) {
            System.setProperty("jna.library.path", "/opt/homebrew/lib");
        }
    }

    private Path resolveTessdataDir(String language) {
        Path fromConfig = normalizeToTessdataDir(localOcrTessdataPath);
        if (hasLanguageData(fromConfig, language)) {
            return fromConfig;
        }

        Path fromEnv = normalizeToTessdataDir(System.getenv("TESSDATA_PREFIX"));
        if (hasLanguageData(fromEnv, language)) {
            return fromEnv;
        }

        for (String dir : DEFAULT_TESSDATA_DIRS) {
            Path candidate = normalizeToTessdataDir(dir);
            if (hasLanguageData(candidate, language)) {
                return candidate;
            }
        }
        return null;
    }

    private static Path normalizeToTessdataDir(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            return null;
        }
        try {
            Path path = Path.of(rawPath.trim());
            if (!Files.isDirectory(path)) {
                return null;
            }
            if (Files.isDirectory(path.resolve("tessdata"))) {
                Path nested = path.resolve("tessdata");
                if (Files.isDirectory(nested)) {
                    return nested;
                }
            }
            return path;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean hasLanguageData(Path tessdataDir, String language) {
        return tessdataDir != null && Files.exists(tessdataDir.resolve(language + ".traineddata"));
    }
}
