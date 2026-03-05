package com.healthplus.payment;

import com.healthplus.model.GatewayPaymentResult;
import com.healthplus.model.GatewayRefundResult;

public interface PaymentGateway {
    GatewayPaymentResult createIntent(String provider, Double amount, String callbackToken);

    GatewayPaymentResult handleCallback(String provider, String callbackToken, String status, String transactionRef);

    GatewayRefundResult refund(String provider, String transactionRef, Double amount);
}
