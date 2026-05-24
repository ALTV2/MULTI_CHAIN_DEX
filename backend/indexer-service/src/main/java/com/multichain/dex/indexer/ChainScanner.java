package com.multichain.dex.indexer;

import com.multichain.dex.domain.entity.Chain;

/**
 * Abstraction for blockchain-specific scanning logic.
 * Each chain type (EVM, SUI) has its own implementation.
 */
public interface ChainScanner {

    /**
     * Scan for new/changed orders on the chain and upsert into DB.
     *
     * @param chain the chain to scan
     */
    void scanOrders(Chain chain);

    /**
     * Update statuses of active HTLCs on the chain.
     *
     * @param chain the chain to scan
     */
    void scanHtlcs(Chain chain);

    /**
     * Process a specific transaction immediately (called from tx/notify).
     *
     * @param chain  the chain where the tx was submitted
     * @param txHash transaction hash
     */
    void processTransaction(Chain chain, String txHash);
}
