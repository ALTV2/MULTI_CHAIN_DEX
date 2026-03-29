package com.multichain.dex.domain.enums;

/**
 * Computed UI phase derived from order status + HTLC statuses.
 * Recalculated by {@link com.multichain.dex.service.PhaseCalculator} on every indexer cycle.
 */
public enum SwapPhase {
    ORDER_CREATED,
    ORDER_MATCHED,
    CREATOR_HTLC_CREATED,
    MATCHER_HTLC_CREATED,
    SECRET_REVEALED,
    COMPLETED,
    REFUNDABLE,
    REFUNDED;

    /** Terminal phases — indexer skips recomputation. */
    public boolean isTerminal() {
        return this == COMPLETED || this == REFUNDED;
    }
}
