package com.multichain.dex.domain.enums;

public enum ChainType {
    ETHEREUM(1, "Ethereum Mainnet"),
    ETHEREUM_SEPOLIA(11155111, "Ethereum Sepolia"),
    POLYGON(137, "Polygon Mainnet"),
    POLYGON_AMOY(80002, "Polygon Amoy");

    private final long chainId;
    private final String displayName;

    ChainType(long chainId, String displayName) {
        this.chainId = chainId;
        this.displayName = displayName;
    }

    public long getChainId() {
        return chainId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static ChainType fromChainId(long chainId) {
        for (ChainType type : values()) {
            if (type.chainId == chainId) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown chain ID: " + chainId);
    }
}
