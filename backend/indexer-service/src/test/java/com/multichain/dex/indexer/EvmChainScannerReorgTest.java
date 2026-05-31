package com.multichain.dex.indexer;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * IDX-REORG: the scanner must stay a finality buffer behind the chain tip so a reorg cannot
 * make it index a since-orphaned SwapWithdrawn/Refunded event as final (which it would then
 * freeze as a terminal phase and never roll back).
 */
class EvmChainScannerReorgTest {

    @Test
    void safeHead_staysConfirmationsBehindTip() {
        assertEquals(900L, EvmChainScanner.safeHead(1000, 100));
        assertEquals(988L, EvmChainScanner.safeHead(1000, 12));
    }

    @Test
    void safeHead_returnsMinusOne_whenChainShorterThanConfirmations() {
        assertEquals(-1L, EvmChainScanner.safeHead(5, 12));
    }

    @Test
    void confirmationsFor_polygonDeeperThanEthereum() {
        assertEquals(12, EvmChainScanner.confirmationsFor("11155111")); // Sepolia
        assertEquals(128, EvmChainScanner.confirmationsFor("80002"));    // Polygon Amoy
        assertTrue(EvmChainScanner.confirmationsFor("80002") > EvmChainScanner.confirmationsFor("11155111"));
    }
}
