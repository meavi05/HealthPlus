package com.healthplus.payment;

import com.healthplus.model.GatewayPaymentResult;
import com.healthplus.model.GatewayRefundResult;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class MockPaymentGateway implements PaymentGateway {
    @Override
    public GatewayPaymentResult createIntent(String provider, Double amount, String callbackToken) {
        String txnRef = (provider + "-txn-" + UUID.randomUUID()).toLowerCase();
        String gatewayRef = "gw-" + UUID.randomUUID();
        return new GatewayPaymentResult("pending", txnRef, gatewayRef);
    }

    @Override
    public GatewayPaymentResult handleCallback(String provider, String callbackToken, String status, String transactionRef) {
        String resolvedStatus = (status == null || status.isBlank()) ? "authorized" : status.toLowerCase();
        String resolvedTxnRef = (transactionRef == null || transactionRef.isBlank())
                ? (provider + "-txn-" + UUID.randomUUID()).toLowerCase()
                : transactionRef;
        String gatewayRef = "gw-callback-" + callbackToken;
        return new GatewayPaymentResult(resolvedStatus, resolvedTxnRef, gatewayRef);
    }

    @Override
    public GatewayRefundResult refund(String provider, String transactionRef, Double amount) {
        return new GatewayRefundResult("refunded", (provider + "-refund-" + UUID.randomUUID()).toLowerCase());
    }
}
