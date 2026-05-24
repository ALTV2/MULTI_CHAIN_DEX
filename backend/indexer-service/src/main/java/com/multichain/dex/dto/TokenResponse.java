package com.multichain.dex.dto;

import com.multichain.dex.domain.entity.Token;

import java.util.UUID;

public record TokenResponse(
        UUID id,
        String chainId,
        String address,
        String symbol,
        String name,
        int decimals,
        boolean isNative
) {
    public static TokenResponse from(Token token) {
        return new TokenResponse(
                token.getId(),
                token.getChain().getId(),
                token.getAddress(),
                token.getSymbol(),
                token.getName(),
                token.getDecimals(),
                token.isNative()
        );
    }
}
