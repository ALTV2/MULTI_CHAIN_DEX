package com.multichain.dex.domain.enums;

/**
 * On-chain order lifecycle status.
 */
public enum OrderStatus {
    ACTIVE,
    MATCHED,
    COMPLETED,
    CANCELLED,
    EXPIRED;

    /** Terminal statuses that never change — indexer skips these. */
    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED || this == EXPIRED;
    }
}
