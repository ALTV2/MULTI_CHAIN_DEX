package com.multichain.dex.kafka.event;

/**
 * Domain event published to Kafka when an order changes phase.
 * Carries everything the (DB-less) notification service needs to compose and send an email,
 * so the two services stay fully decoupled.
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
