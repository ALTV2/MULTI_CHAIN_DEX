package com.multichain.dex.service;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.dto.OrderResponse;
import com.multichain.dex.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Query service for orders. All reads are from the database — no blockchain calls.
 * Filters are composed from {@link OrderSpecifications} via {@link Specification#allOf}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepo;

    /**
     * Fetch orders for the order book with flexible filtering.
     */
    public Page<OrderResponse> findOrders(
            Set<OrderStatus> statuses,
            String sourceChain,
            String targetChain,
            OrderType orderType,
            String sellSymbol,
            String buySymbol,
            Pageable pageable
    ) {
        Specification<Order> spec = Specification.allOf(
                OrderSpecifications.hasStatusIn(statuses),
                OrderSpecifications.hasSourceChain(sourceChain),
                OrderSpecifications.hasTargetChain(targetChain),
                OrderSpecifications.hasOrderType(orderType),
                OrderSpecifications.sellTokenMatches(sellSymbol),
                OrderSpecifications.buyTokenMatches(buySymbol)
        );
        return orderRepo.findAll(spec, pageable).map(OrderResponse::from);
    }

    /**
     * Fetch orders where any of the provided wallet addresses is creator or matcher.
     */
    public Page<OrderResponse> findMyOrders(
            Collection<String> wallets,
            Set<OrderStatus> statuses,
            String role,
            Pageable pageable
    ) {
        Specification<Order> spec = Specification.allOf(
                OrderSpecifications.hasParticipantWallet(normalize(wallets), role),
                OrderSpecifications.hasStatusIn(statuses)
        );
        return orderRepo.findAll(spec, pageable).map(OrderResponse::from);
    }

    private List<String> normalize(Collection<String> wallets) {
        return wallets.stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }
}
