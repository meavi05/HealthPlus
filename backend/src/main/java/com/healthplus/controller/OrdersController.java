package com.healthplus.controller;

import com.healthplus.dto.CreateOrderRequest;
import com.healthplus.dto.OrderCreateResponse;
import com.healthplus.model.OrderView;
import com.healthplus.service.OrderService;
import org.springframework.http.HttpStatus;
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
    public org.springframework.http.ResponseEntity<?> createOrder(@RequestBody CreateOrderRequest request) {
        try {
            Long orderId = orderService.createOrder(request);
            return org.springframework.http.ResponseEntity.status(HttpStatus.CREATED).body(new OrderCreateResponse(orderId));
        } catch (IllegalArgumentException ex) {
            return org.springframework.http.ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
