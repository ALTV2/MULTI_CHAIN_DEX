package com.multichain.dex.service;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import org.springframework.data.jpa.domain.Specification;

import java.util.Collection;
import java.util.Set;

/**
 * Reusable JPA {@link Specification}s for filtering {@link Order} queries.
 * Each method returns {@code null} when its filter is not applicable, so the
 * specifications compose cleanly via {@link Specification#allOf}.
 */
public final class OrderSpecifications {

    private OrderSpecifications() {}

    public static Specification<Order> hasStatusIn(Set<OrderStatus> statuses) {
        return (root, query, cb) ->
                (statuses == null || statuses.isEmpty()) ? null : root.get("status").in(statuses);
    }

    public static Specification<Order> hasSourceChain(String chainId) {
        return (root, query, cb) ->
                chainId == null ? null : cb.equal(root.get("sourceChain").get("id"), chainId);
    }

    public static Specification<Order> hasTargetChain(String chainId) {
        return (root, query, cb) ->
                chainId == null ? null : cb.equal(root.get("targetChain").get("id"), chainId);
    }

    public static Specification<Order> hasOrderType(OrderType orderType) {
        return (root, query, cb) ->
                orderType == null ? null : cb.equal(root.get("orderType"), orderType);
    }

    public static Specification<Order> sellTokenMatches(String symbolOrAddress) {
        return tokenMatches("sellToken", symbolOrAddress);
    }

    public static Specification<Order> buyTokenMatches(String symbolOrAddress) {
        return tokenMatches("buyToken", symbolOrAddress);
    }

    /**
     * Filter by the querying wallets in the given {@code role}:
     * {@code creator}, {@code matcher}, or any other value to match either side.
     * Wallet values are expected to be lower-cased by the caller.
     */
    public static Specification<Order> hasParticipantWallet(Collection<String> lowerWallets, String role) {
        return (root, query, cb) -> {
            if ("creator".equalsIgnoreCase(role)) {
                return cb.lower(root.get("creatorSourceAddress")).in(lowerWallets);
            }
            if ("matcher".equalsIgnoreCase(role)) {
                return cb.lower(root.get("matcherSourceAddress")).in(lowerWallets);
            }
            return cb.or(
                    cb.lower(root.get("creatorSourceAddress")).in(lowerWallets),
                    cb.lower(root.get("matcherSourceAddress")).in(lowerWallets)
            );
        };
    }

    private static Specification<Order> tokenMatches(String relation, String symbolOrAddress) {
        return (root, query, cb) -> {
            if (symbolOrAddress == null) return null;
            String field = symbolOrAddress.startsWith("0x") ? "address" : "symbol";
            return cb.equal(cb.lower(root.get(relation).get(field)), symbolOrAddress.toLowerCase());
        };
    }
}
