package com.multichain.dex.notification.event;

/**
 * Order phase-change event consumed from Kafka. Mirror of the producer's record
 * in the indexer service — the two services share no code, only this JSON contract.
 */
public record OrderPhaseEvent(
        String orderId,
        String sourceChainId,
        String onChainOrderId,
        String orderType,
        String phase,
        String creatorEmail,
        String matcherEmail,
        String creatorAddress,
        String matcherAddress,
        String sellSymbol,
        String sellAmount,
        String buySymbol,
        String buyAmount,
        String sourceChainName,
        String targetChainName
) {}
