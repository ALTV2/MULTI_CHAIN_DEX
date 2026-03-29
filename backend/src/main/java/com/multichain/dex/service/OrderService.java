package com.multichain.dex.service;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.dto.OrderResponse;
import com.multichain.dex.repository.OrderRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Query service for orders. All reads are from the database — no blockchain calls.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepo;

    /**
     * Fetch orders for the order book with flexible filtering.
     *
     * @param statuses     filter by order statuses (default: ACTIVE only)
     * @param sourceChain  filter by source chain id
     * @param targetChain  filter by target chain id
     * @param orderType    filter by SAME_CHAIN or CROSS_CHAIN
     * @param sellSymbol   filter by sell token symbol (case-insensitive)
     * @param buySymbol    filter by buy token symbol (case-insensitive)
     * @param pageable     pagination
     * @return paginated list of orders
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
        Specification<Order> spec = buildSpec(statuses, sourceChain, targetChain, orderType, sellSymbol, buySymbol);
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
        var lowerWallets = normalize(wallets);

        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();

            // Wallet filter: creator OR matcher
            if ("creator".equalsIgnoreCase(role)) {
                predicates.add(cb.lower(root.get("creator")).in(lowerWallets));
            } else if ("matcher".equalsIgnoreCase(role)) {
                predicates.add(cb.lower(root.get("matcher")).in(lowerWallets));
            } else {
                predicates.add(cb.or(
                        cb.lower(root.get("creator")).in(lowerWallets),
                        cb.lower(root.get("matcher")).in(lowerWallets)
                ));
            }

            // Status filter
            if (statuses != null && !statuses.isEmpty()) {
                predicates.add(root.get("status").in(statuses));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return orderRepo.findAll(spec, pageable).map(OrderResponse::from);
    }

    private Specification<Order> buildSpec(
            Set<OrderStatus> statuses,
            String sourceChain,
            String targetChain,
            OrderType orderType,
            String sellSymbol,
            String buySymbol
    ) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();

            if (statuses != null && !statuses.isEmpty()) {
                predicates.add(root.get("status").in(statuses));
            }
            if (sourceChain != null) {
                predicates.add(cb.equal(root.get("sourceChain").get("id"), sourceChain));
            }
            if (targetChain != null) {
                predicates.add(cb.equal(root.get("targetChain").get("id"), targetChain));
            }
            if (orderType != null) {
                predicates.add(cb.equal(root.get("orderType"), orderType));
            }
            if (sellSymbol != null) {
                predicates.add(cb.equal(cb.lower(root.get("sellToken").get("symbol")), sellSymbol.toLowerCase()));
            }
            if (buySymbol != null) {
                predicates.add(cb.equal(cb.lower(root.get("buyToken").get("symbol")), buySymbol.toLowerCase()));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private List<String> normalize(Collection<String> wallets) {
        return wallets.stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }
}
