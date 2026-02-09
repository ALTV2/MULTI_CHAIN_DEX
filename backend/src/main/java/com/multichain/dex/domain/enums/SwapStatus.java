package com.multichain.dex.domain.enums;

public enum SwapStatus {
    PENDING,        // Swap created, waiting for counterparty
    HTLC_CREATED,   // HTLC created on source chain
    HTLC_MATCHED,   // HTLC created on both chains
    WITHDRAWN,      // Successfully withdrawn
    REFUNDED,       // Refunded after timeout
    FAILED,         // Failed for some reason
    EXPIRED         // Order expired before matching
}
