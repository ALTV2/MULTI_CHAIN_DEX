package com.multichain.dex.dto;

import com.multichain.dex.domain.entity.Token;

/**
 * Lightweight token info embedded in order/swap responses.
 */
public record TokenInfo(
        String address,
        String symbol,
        String name,
        int decimals,
        boolean isNative
) {
    public static TokenInfo from(Token token) {
        return new TokenInfo(
                token.getAddress(),
                token.getSymbol(),
                token.getName(),
                token.getDecimals(),
                token.isNative()
        );
    }
}
