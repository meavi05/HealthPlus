package com.healthplus.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final LocalUserService localUserService;
    private final ObjectMapper objectMapper;

    public AuthController(LocalUserService localUserService, ObjectMapper objectMapper) {
        this.localUserService = localUserService;
        this.objectMapper = objectMapper;
    }

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.auth.mobile-otp.debug:false}")
    private boolean mobileOtpDebug;

    @Value("${app.auth.mobile-otp.twilio.enabled:true}")
    private boolean twilioEnabled;

    @Value("${app.auth.mobile-otp.twilio.account-sid:}")
    private String twilioAccountSid;

    @Value("${app.auth.mobile-otp.twilio.auth-token:}")
    private String twilioAuthToken;

    @Value("${app.auth.mobile-otp.twilio.verify-service-sid:}")
    private String twilioVerifyServiceSid;

    @Value("${app.auth.mobile-otp.twilio.base-url:https://verify.twilio.com}")
    private String twilioBaseUrl;

    @Value("${app.auth.mobile-otp.country-code:91}")
    private String otpCountryCode;

    @GetMapping("/google")
    public void google(HttpServletResponse response) throws IOException {
        response.sendRedirect("/oauth2/authorization/google");
    }

    @GetMapping("/facebook")
    public void facebook(HttpServletResponse response) throws IOException {
        response.sendRedirect("/oauth2/authorization/facebook");
    }

    @GetMapping("/logout")
    public void logout(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            new SecurityContextLogoutHandler().logout(request, response, authentication);
        }
        response.sendRedirect(frontendUrl + "/");
    }

    @PostMapping("/mobile/send-otp")
    public ResponseEntity<?> sendMobileOtp(@RequestBody MobileOtpSendRequest request) {
        String mobile = normalizeMobile(request.mobileNumber());
        if (mobile.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid 10-digit mobile number is required"));
        }
        try {
            sendOtpViaTwilioVerify(mobile);
        } catch (IllegalStateException providerConfigError) {
            return ResponseEntity.badRequest().body(Map.of("message", providerConfigError.getMessage()));
        } catch (Exception providerError) {
            return ResponseEntity.status(502).body(Map.of("message", "Unable to send OTP right now. Please try again."));
        }

        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("message", "OTP sent successfully");
        payload.put("mobile_number", mobile);
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/mobile/verify-otp")
    public ResponseEntity<?> verifyMobileOtp(@RequestBody MobileOtpVerifyRequest request, HttpServletRequest httpRequest) {
        String mobile = normalizeMobile(request.mobileNumber());
        if (mobile.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid 10-digit mobile number is required"));
        }
        String otp = request.otp() == null ? "" : request.otp().trim();
        if (otp.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "OTP is required"));
        }
        try {
            boolean approved = verifyOtpViaTwilioVerify(mobile, otp);
            if (!approved) {
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid OTP"));
            }
        } catch (IllegalStateException providerConfigError) {
            return ResponseEntity.badRequest().body(Map.of("message", providerConfigError.getMessage()));
        } catch (Exception providerError) {
            return ResponseEntity.status(502).body(Map.of("message", "Unable to verify OTP right now. Please try again."));
        }

        LocalUser user = localUserService.resolveOrCreateByMobile(mobile, request.name());
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority(user.role()))
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
        httpRequest.getSession(true).setAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                new SecurityContextImpl(authentication)
        );

        return ResponseEntity.ok(localUserService.toPayload(user));
    }

    private static String normalizeMobile(String value) {
        if (value == null) {
            return "";
        }
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        }
        return digits.length() == 10 ? digits : "";
    }

    private void sendOtpViaTwilioVerify(String mobile) throws IOException {
        if (!twilioEnabled) {
            return;
        }
        if (twilioAccountSid == null || twilioAccountSid.isBlank()
                || twilioAuthToken == null || twilioAuthToken.isBlank()
                || twilioVerifyServiceSid == null || twilioVerifyServiceSid.isBlank()) {
            throw new IllegalStateException("Twilio Verify is not configured");
        }

        String to = buildE164Mobile(mobile);
        String body = "To=" + urlEncode(to) + "&Channel=sms";
        URL url = URI.create(twilioBaseUrl.trim() + "/v2/Services/" + twilioVerifyServiceSid.trim() + "/Verifications").toURL();
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        connection.setRequestProperty("Authorization", basicAuthHeader());
        connection.setDoOutput(true);

        try (OutputStream os = connection.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            byte[] errorBytes = connection.getErrorStream() == null ? new byte[0] : connection.getErrorStream().readAllBytes();
            throw new IOException("Twilio Verify send failed with status " + status + ": " + new String(errorBytes, StandardCharsets.UTF_8));
        }
    }

    private boolean verifyOtpViaTwilioVerify(String mobile, String otp) throws IOException {
        if (!twilioEnabled) {
            return mobileOtpDebug;
        }
        if (twilioAccountSid == null || twilioAccountSid.isBlank()
                || twilioAuthToken == null || twilioAuthToken.isBlank()
                || twilioVerifyServiceSid == null || twilioVerifyServiceSid.isBlank()) {
            throw new IllegalStateException("Twilio Verify is not configured");
        }

        String to = buildE164Mobile(mobile);
        String body = "To=" + urlEncode(to) + "&Code=" + urlEncode(otp);
        URL url = URI.create(twilioBaseUrl.trim() + "/v2/Services/" + twilioVerifyServiceSid.trim() + "/VerificationCheck").toURL();
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        connection.setRequestProperty("Authorization", basicAuthHeader());
        connection.setDoOutput(true);

        try (OutputStream os = connection.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        int status = connection.getResponseCode();
        byte[] responseBytes = status >= 200 && status < 300
                ? connection.getInputStream().readAllBytes()
                : connection.getErrorStream() == null ? new byte[0] : connection.getErrorStream().readAllBytes();
        if (status < 200 || status >= 300) {
            throw new IOException("Twilio Verify check failed with status " + status + ": " + new String(responseBytes, StandardCharsets.UTF_8));
        }
        String responseText = new String(responseBytes, StandardCharsets.UTF_8);
        JsonNode root = objectMapper.readTree(responseText);
        String statusText = root.path("status").asText("");
        boolean valid = root.path("valid").asBoolean(false);
        return "approved".equalsIgnoreCase(statusText) || valid;
    }

    private String basicAuthHeader() {
        String token = (twilioAccountSid == null ? "" : twilioAccountSid.trim()) + ":" + (twilioAuthToken == null ? "" : twilioAuthToken.trim());
        return "Basic " + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8));
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String buildE164Mobile(String mobile) {
        String country = otpCountryCode == null ? "91" : otpCountryCode.trim();
        country = country.replaceAll("[^0-9]", "");
        if (country.isBlank()) {
            country = "91";
        }
        return "+" + country + mobile;
    }

    private record MobileOtpSendRequest(@JsonProperty("mobile_number") String mobileNumber) {}
    private record MobileOtpVerifyRequest(
            @JsonProperty("mobile_number") String mobileNumber,
            String otp,
            String name
    ) {}
}
