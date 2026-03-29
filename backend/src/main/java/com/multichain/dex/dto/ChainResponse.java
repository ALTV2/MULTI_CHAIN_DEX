package com.multichain.dex.dto;

import com.multichain.dex.domain.entity.Chain;

import java.util.Map;

public record ChainResponse(
        String id,
        String name,
        String shortName,
        String chainType,
        String blockExplorer,
        String nativeSymbol,
        int nativeDecimals,
        Map<String, String> contracts
) {
    public static ChainResponse from(Chain chain) {
        return new ChainResponse(
                chain.getId(),
                chain.getName(),
                chain.getShortName(),
                chain.getChainType().name(),
                chain.getBlockExplorer(),
                chain.getNativeSymbol(),
                chain.getNativeDecimals(),
                chain.getContracts()
        );
    }
}
