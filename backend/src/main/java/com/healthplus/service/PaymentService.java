package com.healthplus.service;

import com.healthplus.dto.CreatePaymentIntentRequest;
import com.healthplus.dto.PaymentCallbackRequest;
import com.healthplus.dto.PaymentIntentResponse;
import com.healthplus.model.GatewayPaymentResult;
import com.healthplus.payment.PaymentGateway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {
    private final JdbcTemplate jdbcTemplate;
    private final PaymentGateway paymentGateway;

    public PaymentService(JdbcTemplate jdbcTemplate, PaymentGateway paymentGateway) {
        this.jdbcTemplate = jdbcTemplate;
        this.paymentGateway = paymentGateway;
    }

    @Transactional
    public PaymentIntentResponse createIntent(CreatePaymentIntentRequest request) {
        if (request.userId() == null || request.paymentMethod() == null || request.paymentMethod().isBlank() || request.amount() == null || request.amount() <= 0) {
            throw new IllegalArgumentException("user_id, payment_method and amount are required");
        }

        String provider = request.paymentMethod().toLowerCase();
        String callbackToken = UUID.randomUUID().toString();

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_payment_methods WHERE user_id = ? AND provider = ? AND status = 'active' AND is_verified = 1",
                Integer.class,
                request.userId(),
                provider
        );
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Register selected payment method before creating payment intent");
        }

        GatewayPaymentResult gatewayResult = paymentGateway.createIntent(provider, request.amount(), callbackToken);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO payment_intents (user_id, provider, amount, status, transaction_ref, callback_token, gateway_reference) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, request.userId());
            ps.setString(2, provider);
            ps.setDouble(3, request.amount());
            ps.setString(4, gatewayResult.status());
            ps.setString(5, gatewayResult.transactionRef());
            ps.setString(6, callbackToken);
            ps.setString(7, gatewayResult.gatewayReference());
            return ps;
        }, keyHolder);

        Long intentId = keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
        if (intentId == null) {
            throw new IllegalStateException("Payment intent creation failed");
        }

        return new PaymentIntentResponse(intentId, gatewayResult.status(), gatewayResult.transactionRef(), callbackToken);
    }

    @Transactional
    public PaymentIntentResponse handleIntentCallback(Long intentId, PaymentCallbackRequest request) {
        List<PaymentIntentRow> rows = jdbcTemplate.query(
                "SELECT id, provider, callback_token FROM payment_intents WHERE id = ?",
                (rs, rowNum) -> new PaymentIntentRow(rs.getLong("id"), rs.getString("provider"), rs.getString("callback_token")),
                intentId
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Payment intent not found");
        }

        PaymentIntentRow row = rows.get(0);
        GatewayPaymentResult callbackResult = paymentGateway.handleCallback(row.provider(), row.callbackToken(), request.status(), request.transactionRef());

        jdbcTemplate.update(
                "UPDATE payment_intents SET status = ?, transaction_ref = ?, gateway_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                callbackResult.status(),
                callbackResult.transactionRef(),
                callbackResult.gatewayReference(),
                intentId
        );

        return new PaymentIntentResponse(intentId, callbackResult.status(), callbackResult.transactionRef(), row.callbackToken());
    }

    private record PaymentIntentRow(Long id, String provider, String callbackToken) {}
}
