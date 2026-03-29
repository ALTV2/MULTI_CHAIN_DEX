package com.multichain.dex.domain.enums;

/**
 * Who created the HTLC within a cross-chain swap.
 * Each cross-chain order has at most two HTLCs: one per role.
 */
public enum HtlcRole {
    CREATOR,
    MATCHER
}
