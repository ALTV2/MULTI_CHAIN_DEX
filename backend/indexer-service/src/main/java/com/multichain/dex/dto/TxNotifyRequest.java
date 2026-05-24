package com.multichain.dex.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Frontend notifies backend about a newly submitted transaction
 * so the indexer can process it immediately instead of waiting for the next polling cycle.
 */
public record TxNotifyRequest(
        @NotBlank String chainId,
        @NotBlank String txHash,
        @NotBlank String type,    // ORDER_CREATE, ORDER_MATCH, HTLC_CREATE, HTLC_WITHDRAW, etc.
        String orderId,           // on-chain order ID if known
        String wallet             // sender address
) {}
