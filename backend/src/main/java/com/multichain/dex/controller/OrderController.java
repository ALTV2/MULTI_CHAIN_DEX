package com.multichain.dex.controller;

import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.dto.OrderResponse;
import com.multichain.dex.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v2/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * Order book: browse all orders with flexible filtering.
     * Default: only ACTIVE orders, sorted by newest first.
     */
    @GetMapping
    public Page<OrderResponse> getOrders(
            @RequestParam(defaultValue = "ACTIVE") String status,
            @RequestParam(required = false) String sourceChain,
            @RequestParam(required = false) String targetChain,
            @RequestParam(required = false) String orderType,
            @RequestParam(required = false) String sellToken,
            @RequestParam(required = false) String buyToken,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Set<OrderStatus> statuses = parseStatuses(status);
        OrderType type = orderType != null ? OrderType.valueOf(orderType.toUpperCase()) : null;
        var pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "createdAt"));

        return orderService.findOrders(statuses, sourceChain, targetChain, type, sellToken, buyToken, pageable);
    }

    /**
     * My orders: orders where any of the provided wallet addresses is creator or matcher.
     */
    @GetMapping("/my")
    public Page<OrderResponse> getMyOrders(
            @RequestParam List<String> wallet,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Set<OrderStatus> statuses = status != null ? parseStatuses(status) : null;
        var pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "createdAt"));

        return orderService.findMyOrders(wallet, statuses, role, pageable);
    }

    private Set<OrderStatus> parseStatuses(String statusStr) {
        return Arrays.stream(statusStr.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> OrderStatus.valueOf(s.toUpperCase()))
                .collect(Collectors.toSet());
    }
}
