package com.multichain.dex.service;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.dto.TxNotifyRequest;
import com.multichain.dex.indexer.BlockchainIndexer;
import com.multichain.dex.repository.ChainRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Handles transaction notifications from the frontend.
 * Delegates to {@link BlockchainIndexer#processChain(Chain)} which acquires the
 * indexer lock, preventing concurrent writes with the scheduled polling cycle.
 */
@Slf4j
@Service
public class TxNotifyService {

    private final ChainRepository chainRepo;
    /** Optional: may be null if indexer is disabled in config. */
    private final BlockchainIndexer indexer;

    @Autowired
    public TxNotifyService(ChainRepository chainRepo,
                           @Autowired(required = false) BlockchainIndexer indexer) {
        this.chainRepo = chainRepo;
        this.indexer = indexer;
    }

    /**
     * Process a transaction notification asynchronously.
     */
    @Async
    public void processAsync(TxNotifyRequest request) {
        log.info("Processing tx notification: chain={}, tx={}, type={}",
                request.chainId(), request.txHash(), request.type());

        try {
            if (indexer == null) {
                log.warn("Indexer disabled, skipping tx notification");
                return;
            }

            Chain chain = chainRepo.findById(request.chainId()).orElse(null);
            if (chain == null) {
                log.warn("Unknown chain in tx notification: {}", request.chainId());
                return;
            }

            indexer.processChain(chain);

            log.info("Successfully processed tx notification: {}", request.txHash());
        } catch (Exception e) {
            log.error("Failed to process tx notification: chain={}, tx={}",
                    request.chainId(), request.txHash(), e);
        }
    }
}
