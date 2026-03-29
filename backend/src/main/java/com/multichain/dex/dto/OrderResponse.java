package com.multichain.dex.dto;

import com.multichain.dex.domain.entity.Order;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.MathContext;
import java.time.Instant;
import java.util.UUID;

/**
 * Order data returned by REST API. Includes formatted amounts for display.
 */
public record OrderResponse(
        UUID id,
        String sourceChainId,
        String onChainOrderId,
        String orderType,
        String creator,
        String matcher,
        TokenInfo sellToken,
        String sellAmount,
        String formattedSellAmount,
        TokenInfo buyToken,
        String buyAmount,
        String formattedBuyAmount,
        String targetChainId,
        String targetAddress,
        String status,
        String phase,
        Long expiresAt,
        Instant createdAt,
        Instant matchedAt,
        Instant completedAt
) {
    public static OrderResponse from(Order order) {
        var sellToken = order.getSellToken();
        var buyToken = order.getBuyToken();

        return new OrderResponse(
                order.getId(),
                order.getSourceChainId(),
                order.getOnChainOrderId(),
                order.getOrderType().name(),
                order.getCreator(),
                order.getMatcher(),
                sellToken != null ? TokenInfo.from(sellToken) : null,
                order.getSellAmount().toString(),
                formatAmount(order.getSellAmount(), sellToken != null ? sellToken.getDecimals() : 18),
                buyToken != null ? TokenInfo.from(buyToken) : null,
                order.getBuyAmount().toString(),
                formatAmount(order.getBuyAmount(), buyToken != null ? buyToken.getDecimals() : 18),
                order.getTargetChainId(),
                order.getTargetAddress(),
                order.getStatus().name(),
                order.getPhase().name(),
                order.getExpiresAt() != null ? order.getExpiresAt().getEpochSecond() : null,
                order.getCreatedAt(),
                order.getMatchedAt(),
                order.getCompletedAt()
        );
    }

    /** Convert raw token amount to human-readable string using token decimals. */
    private static String formatAmount(BigInteger raw, int decimals) {
        if (raw == null || raw.equals(BigInteger.ZERO)) return "0";
        if (decimals == 0) return raw.toString();
        var divisor = BigDecimal.TEN.pow(decimals);
        return new BigDecimal(raw).divide(divisor, MathContext.DECIMAL64).stripTrailingZeros().toPlainString();
    }
}
