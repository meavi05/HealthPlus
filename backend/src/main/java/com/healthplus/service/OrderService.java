package com.healthplus.service;

import com.healthplus.dto.CreateOrderItemRequest;
import com.healthplus.dto.CreateOrderRequest;
import com.healthplus.model.OrderItemView;
import com.healthplus.model.OrderView;
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

    public OrderService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<OrderView> getOrdersByUserId(Long userId) {
        List<OrderView> orders = jdbcTemplate.query(
                "SELECT id, user_id, total_price, status, created_at FROM orders WHERE user_id = ?",
                (rs, rowNum) -> new OrderView(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getDouble("total_price"),
                        rs.getString("status"),
                        rs.getString("created_at"),
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
            return new OrderView(order.id(), order.userId(), order.totalPrice(), order.status(), order.createdAt(), items);
        }).toList();
    }

    @Transactional
    public Long createOrder(CreateOrderRequest request) {
        if (request.paymentMethod() == null || request.paymentMethod().isBlank()) {
            throw new IllegalArgumentException("Payment method is required");
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
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO orders (user_id, total_price, payment_method, payment_status) VALUES (?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, request.userId());
            ps.setDouble(2, request.totalPrice());
            ps.setString(3, request.paymentMethod().toLowerCase());
            ps.setString(4, "authorized");
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
                    item.price()
            );
        }
        return orderId;
    }
}
