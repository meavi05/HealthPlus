package com.healthplus.service;

import com.healthplus.dto.CreateOrderItemRequest;
import com.healthplus.dto.CreateOrderRequest;
import com.healthplus.model.GatewayRefundResult;
import com.healthplus.model.OrderItemView;
import com.healthplus.model.OrderView;
import com.healthplus.payment.PaymentGateway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

@Service
public class OrderService {
    private final JdbcTemplate jdbcTemplate;
    private final PaymentGateway paymentGateway;
    private final UserService userService;

    public OrderService(JdbcTemplate jdbcTemplate, PaymentGateway paymentGateway, UserService userService) {
        this.jdbcTemplate = jdbcTemplate;
        this.paymentGateway = paymentGateway;
        this.userService = userService;
    }

    public List<OrderView> getOrdersByUserId(Long userId) {
        List<OrderView> orders = jdbcTemplate.query(
                "SELECT id, user_id, total_price, status, created_at, payment_status, transaction_ref FROM orders WHERE user_id = ? ORDER BY id DESC",
                (rs, rowNum) -> new OrderView(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getDouble("total_price"),
                        rs.getString("status"),
                        rs.getString("created_at"),
                        rs.getString("payment_status"),
                        rs.getString("transaction_ref"),
                        new ArrayList<>()
                ),
                userId
        );

        return orders.stream().map(order -> {
            List<OrderItemView> items = jdbcTemplate.query(
                    """
                    SELECT oi.id, oi.quantity, oi.price, m.name as medicine_name
                    FROM order_items oi
                    JOIN medicines m ON oi.medicine_id = m.id
                    WHERE oi.order_id = ?
                    """,
                    (rs, rowNum) -> new OrderItemView(
                            rs.getLong("id"),
                            rs.getString("medicine_name"),
                            rs.getInt("quantity"),
                            rs.getDouble("price")
                    ),
                    order.id()
            );
            return new OrderView(order.id(), order.userId(), order.totalPrice(), order.status(), order.createdAt(), order.paymentStatus(), order.transactionRef(), items);
        }).toList();
    }

    @Transactional
    public Long createOrder(CreateOrderRequest request) {
        if (request.paymentMethod() == null || request.paymentMethod().isBlank()) {
            throw new IllegalArgumentException("Payment method is required");
        }
        if (request.paymentIntentId() == null) {
            throw new IllegalArgumentException("Authorized payment intent is required");
        }
        if (request.deliveryAddressId() == null) {
            throw new IllegalArgumentException("Delivery address is required");
        }
        if (!userService.userOwnsDeliveryAddress(request.userId(), request.deliveryAddressId())) {
            throw new IllegalArgumentException("Invalid delivery address");
        }

        Integer paymentMethodCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_payment_methods WHERE user_id = ? AND provider = ? AND status = 'active' AND is_verified = 1",
                Integer.class,
                request.userId(),
                request.paymentMethod().toLowerCase()
        );

        if (paymentMethodCount == null || paymentMethodCount == 0) {
            throw new IllegalArgumentException("Register selected payment method before placing order");
        }

        List<IntentRow> intents = jdbcTemplate.query(
                "SELECT id, transaction_ref, status, provider, amount FROM payment_intents WHERE id = ? AND user_id = ?",
                (rs, rowNum) -> new IntentRow(
                        rs.getLong("id"),
                        rs.getString("transaction_ref"),
                        rs.getString("status"),
                        rs.getString("provider"),
                        rs.getDouble("amount")
                ),
                request.paymentIntentId(),
                request.userId()
        );

        if (intents.isEmpty()) {
            throw new IllegalArgumentException("Payment intent not found for user");
        }
        IntentRow intent = intents.get(0);
        if (!"authorized".equalsIgnoreCase(intent.status())) {
            throw new IllegalArgumentException("Payment intent is not authorized");
        }
        if (!intent.provider().equalsIgnoreCase(request.paymentMethod())) {
            throw new IllegalArgumentException("Payment method does not match payment intent");
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO orders (user_id, total_price, payment_method, payment_status, payment_intent_id, transaction_ref, delivery_address_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, request.userId());
            ps.setDouble(2, roundCurrency(request.totalPrice()));
            ps.setString(3, request.paymentMethod().toLowerCase());
            ps.setString(4, "authorized");
            ps.setLong(5, request.paymentIntentId());
            ps.setString(6, intent.transactionRef());
            ps.setLong(7, request.deliveryAddressId());
            return ps;
        }, keyHolder);

        Long orderId = keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
        if (orderId == null) {
            throw new IllegalStateException("Order insertion failed");
        }

        for (CreateOrderItemRequest item : request.items()) {
            jdbcTemplate.update(
                    "INSERT INTO order_items (order_id, medicine_id, quantity, price) VALUES (?, ?, ?, ?)",
                    orderId,
                    item.medicineId(),
                    item.quantity(),
                    roundCurrency(item.price())
            );
        }
        return orderId;
    }

    @Transactional
    public void cancelOrder(Long orderId, Long userId) {
        List<OrderRow> rows = jdbcTemplate.query(
                "SELECT id, user_id, status FROM orders WHERE id = ?",
                (rs, rowNum) -> new OrderRow(rs.getLong("id"), rs.getLong("user_id"), rs.getString("status")),
                orderId
        );
        if (rows.isEmpty() || !rows.get(0).userId().equals(userId)) {
            throw new IllegalArgumentException("Order not found");
        }
        String status = rows.get(0).status() == null ? "" : rows.get(0).status().toLowerCase();
        if ("cancelled".equals(status) || "refunded".equals(status)) {
            throw new IllegalArgumentException("Order already closed");
        }

        jdbcTemplate.update(
                "UPDATE orders SET status = 'cancelled', payment_status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?",
                orderId
        );
    }

    @Transactional
    public String refundOrder(Long orderId, Long userId) {
        List<RefundRow> rows = jdbcTemplate.query(
                "SELECT id, user_id, total_price, payment_method, transaction_ref, payment_status FROM orders WHERE id = ?",
                (rs, rowNum) -> new RefundRow(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getDouble("total_price"),
                        rs.getString("payment_method"),
                        rs.getString("transaction_ref"),
                        rs.getString("payment_status")
                ),
                orderId
        );
        if (rows.isEmpty() || !rows.get(0).userId().equals(userId)) {
            throw new IllegalArgumentException("Order not found");
        }

        RefundRow order = rows.get(0);
        if (order.paymentStatus() != null && "refunded".equalsIgnoreCase(order.paymentStatus())) {
            throw new IllegalArgumentException("Order already refunded");
        }

        GatewayRefundResult refundResult = paymentGateway.refund(order.paymentMethod(), order.transactionRef(), order.totalPrice());
        if (!"refunded".equalsIgnoreCase(refundResult.status())) {
            throw new IllegalArgumentException("Refund failed at gateway");
        }

        jdbcTemplate.update(
                "UPDATE orders SET status = 'refunded', payment_status = 'refunded', refunded_at = CURRENT_TIMESTAMP, refund_ref = ? WHERE id = ?",
                refundResult.refundRef(),
                orderId
        );
        return refundResult.refundRef();
    }

    private record IntentRow(Long id, String transactionRef, String status, String provider, Double amount) {}

    private record OrderRow(Long id, Long userId, String status) {}

    private record RefundRow(Long id, Long userId, Double totalPrice, String paymentMethod, String transactionRef, String paymentStatus) {}

    private static double roundCurrency(Double value) {
        if (value == null) {
            return 0;
        }
        return Math.round(value * 100.0) / 100.0;
    }
}
