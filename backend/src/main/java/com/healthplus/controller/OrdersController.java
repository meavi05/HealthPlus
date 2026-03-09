package com.healthplus.controller;

import com.healthplus.dto.CreateOrderRequest;
import com.healthplus.dto.OrderCreateResponse;
import com.healthplus.model.OrderView;
import com.healthplus.security.LocalUser;
import com.healthplus.security.LocalUserService;
import com.healthplus.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrdersController {
    private final OrderService orderService;
    private final LocalUserService localUserService;

    public OrdersController(OrderService orderService, LocalUserService localUserService) {
        this.orderService = orderService;
        this.localUserService = localUserService;
    }

    @GetMapping("/me")
    public List<OrderView> getMyOrders(Authentication authentication) {
        LocalUser current = localUserService.resolveOrCreate(authentication);
        return orderService.getOrdersByUserId(current.id());
    }

    @PostMapping
    public ResponseEntity<?> createOrder(Authentication authentication, @RequestBody CreateOrderRequest request) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            CreateOrderRequest normalized = new CreateOrderRequest(
                    current.id(),
                    request.paymentMethod(),
                    request.paymentIntentId(),
                    request.deliveryAddressId(),
                    request.items(),
                    request.totalPrice()
            );
            Long orderId = orderService.createOrder(normalized);
            return ResponseEntity.status(HttpStatus.CREATED).body(new OrderCreateResponse(orderId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<?> cancelOrder(Authentication authentication, @PathVariable Long orderId) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            orderService.cancelOrder(orderId, current.id());
            return ResponseEntity.ok(Map.of("message", "Order cancelled"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{orderId}/refund")
    public ResponseEntity<?> refundOrder(Authentication authentication, @PathVariable Long orderId) {
        try {
            LocalUser current = localUserService.resolveOrCreate(authentication);
            String refundRef = orderService.refundOrder(orderId, current.id());
            return ResponseEntity.ok(Map.of("message", "Order refunded", "refund_ref", refundRef));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
