package com.healthplus.controller;

import com.healthplus.dto.CreateOrderRequest;
import com.healthplus.dto.OrderCreateResponse;
import com.healthplus.model.OrderView;
import com.healthplus.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrdersController {
    private final OrderService orderService;

    public OrdersController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/{userId}")
    public List<OrderView> getOrders(@PathVariable Long userId) {
        return orderService.getOrdersByUserId(userId);
    }

    @PostMapping
    public ResponseEntity<?> createOrder(@RequestBody CreateOrderRequest request) {
        try {
            Long orderId = orderService.createOrder(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(new OrderCreateResponse(orderId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable Long orderId, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.parseLong(String.valueOf(request.get("user_id")));
            orderService.cancelOrder(orderId, userId);
            return ResponseEntity.ok(Map.of("message", "Order cancelled"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{orderId}/refund")
    public ResponseEntity<?> refundOrder(@PathVariable Long orderId, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.parseLong(String.valueOf(request.get("user_id")));
            String refundRef = orderService.refundOrder(orderId, userId);
            return ResponseEntity.ok(Map.of("message", "Order refunded", "refund_ref", refundRef));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
