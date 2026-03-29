package com.multichain.dex.service;

import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.*;
import com.multichain.dex.repository.HtlcSwapRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Pure logic component that computes the UI swap phase from order + HTLC statuses.
 * Called by the indexer after every scan cycle for non-terminal orders.
 *
 * <p>Phase is derived entirely from database state — zero blockchain calls.</p>
 */
@Component
@RequiredArgsConstructor
public class PhaseCalculator {

    /** Terminal phases that never change. */
    public static final Set<SwapPhase> TERMINAL_PHASES = Set.of(SwapPhase.COMPLETED, SwapPhase.REFUNDED);

    private final HtlcSwapRepository htlcRepo;

    /**
     * Compute the current phase for an order based on its status and HTLC states.
     *
     * @param order the order to evaluate
     * @return computed phase
     */
    public SwapPhase compute(Order order) {
        // Terminal order statuses
        if (order.getStatus() == OrderStatus.COMPLETED) return SwapPhase.COMPLETED;
        if (order.getStatus() == OrderStatus.CANCELLED) return SwapPhase.REFUNDED;

        // Same-chain orders: no HTLCs involved
        if (order.getOrderType() == OrderType.SAME_CHAIN) {
            if (order.getExecutionTxHash() != null) return SwapPhase.COMPLETED;
            if (order.getMatcher() != null) return SwapPhase.ORDER_MATCHED;
            return SwapPhase.ORDER_CREATED;
        }

        // Cross-chain: look up both HTLCs
        HtlcSwap creatorHtlc = htlcRepo.findByOrderIdAndRole(order.getId(), HtlcRole.CREATOR).orElse(null);
        HtlcSwap matcherHtlc = htlcRepo.findByOrderIdAndRole(order.getId(), HtlcRole.MATCHER).orElse(null);

        HtlcStatus cs = creatorHtlc != null ? creatorHtlc.getStatus() : null;
        HtlcStatus ms = matcherHtlc != null ? matcherHtlc.getStatus() : null;

        // Both withdrawn → swap completed
        if (cs == HtlcStatus.WITHDRAWN && ms == HtlcStatus.WITHDRAWN) {
            return SwapPhase.COMPLETED;
        }

        // One withdrawn, other active → secret has been revealed (but check expiry)
        if (cs == HtlcStatus.WITHDRAWN && ms == HtlcStatus.ACTIVE) {
            return isExpired(matcherHtlc) ? SwapPhase.REFUNDABLE : SwapPhase.SECRET_REVEALED;
        }
        if (ms == HtlcStatus.WITHDRAWN && cs == HtlcStatus.ACTIVE) {
            return isExpired(creatorHtlc) ? SwapPhase.REFUNDABLE : SwapPhase.SECRET_REVEALED;
        }

        // Both active → both parties locked tokens (check expiry first)
        if (cs == HtlcStatus.ACTIVE && ms == HtlcStatus.ACTIVE) {
            if (isExpired(creatorHtlc) || isExpired(matcherHtlc)) {
                return SwapPhase.REFUNDABLE;
            }
            return SwapPhase.MATCHER_HTLC_CREATED;
        }

        // Only creator locked
        if (cs == HtlcStatus.ACTIVE && ms == null) {
            return isExpired(creatorHtlc) ? SwapPhase.REFUNDABLE : SwapPhase.CREATOR_HTLC_CREATED;
        }

        // Only matcher locked (SUI→EVM pattern: matcher locks first)
        if (ms == HtlcStatus.ACTIVE && cs == null) {
            return isExpired(matcherHtlc) ? SwapPhase.REFUNDABLE : SwapPhase.ORDER_MATCHED;
        }

        // Any HTLC refunded
        if (cs == HtlcStatus.REFUNDED || ms == HtlcStatus.REFUNDED) {
            return SwapPhase.REFUNDED;
        }

        // Any active HTLC expired
        if (isExpired(creatorHtlc) || isExpired(matcherHtlc)) {
            return SwapPhase.REFUNDABLE;
        }

        // Order matched but no HTLCs yet
        if (order.getMatcher() != null || order.getStatus() == OrderStatus.MATCHED) {
            return SwapPhase.ORDER_MATCHED;
        }

        // Expired order without any HTLCs
        if (order.getStatus() == OrderStatus.EXPIRED) {
            return SwapPhase.REFUNDED;
        }

        return SwapPhase.ORDER_CREATED;
    }

    private boolean isExpired(HtlcSwap htlc) {
        return htlc != null && htlc.isExpired();
    }
}
