package com.multichain.dex.indexer;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.SwapPhase;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.OrderRepository;
import com.multichain.dex.service.PhaseCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Scheduled blockchain indexer. Polls all enabled chains at a configured interval,
 * upserts orders and HTLC data into the database, and recomputes swap phases.
 *
 * <p>Uses a {@link ReentrantLock} to prevent concurrent execution between
 * scheduled polling and on-demand {@code processTransaction()} from tx/notify.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "indexer.enabled", havingValue = "true", matchIfMissing = true)
public class BlockchainIndexer {

    private final ChainRepository chainRepo;
    private final OrderRepository orderRepo;
    private final ChainScannerFactory scannerFactory;
    private final PhaseCalculator phaseCalculator;

    /** Prevents concurrent writes from scheduled poll and tx/notify. */
    private final ReentrantLock indexLock = new ReentrantLock();

    /**
     * Main polling loop. Runs at the configured interval.
     * Skips if a previous cycle or tx/notify is still running.
     */
    @Scheduled(fixedDelayString = "${indexer.polling-interval:10000}")
    public void poll() {
        if (!indexLock.tryLock()) {
            log.debug("Indexer cycle skipped — previous cycle still running");
            return;
        }
        try {
            doPoll();
        } finally {
            indexLock.unlock();
        }
    }

    /**
     * Process a single chain immediately (called from tx/notify).
     * Acquires the same lock to prevent conflicts with poll().
     */
    public void processChain(Chain chain) {
        indexLock.lock();
        try {
            ChainScanner scanner = scannerFactory.getScanner(chain);
            scanner.scanOrders(chain);
            scanner.scanHtlcs(chain);
            chain.setLastPolledAt(Instant.now());
            chainRepo.save(chain);
            recomputePhases();
        } catch (Exception e) {
            log.error("Failed to process chain {}", chain.getId(), e);
        } finally {
            indexLock.unlock();
        }
    }

    private void doPoll() {
        List<Chain> chains = chainRepo.findByPollingEnabledTrue();
        if (chains.isEmpty()) return;

        log.debug("Indexer cycle starting for {} chain(s)", chains.size());
        long start = System.currentTimeMillis();

        for (Chain chain : chains) {
            try {
                ChainScanner scanner = scannerFactory.getScanner(chain);
                scanner.scanOrders(chain);
                scanner.scanHtlcs(chain);
                chain.setLastPolledAt(Instant.now());
                chainRepo.save(chain);
            } catch (Exception e) {
                log.error("Indexer failed for chain {}", chain.getId(), e);
            }
        }

        recomputePhases();

        long elapsed = System.currentTimeMillis() - start;
        log.debug("Indexer cycle completed in {}ms", elapsed);
    }

    /**
     * Recompute phases for all non-terminal orders.
     * Terminal orders (COMPLETED, REFUNDED) are never recomputed.
     */
    @Transactional
    public void recomputePhases() {
        List<Order> activeOrders = orderRepo.findByPhaseNotIn(PhaseCalculator.TERMINAL_PHASES);
        int updated = 0;

        for (Order order : activeOrders) {
            SwapPhase newPhase = phaseCalculator.compute(order);
            if (newPhase != order.getPhase()) {
                order.setPhase(newPhase);
                if (newPhase == SwapPhase.COMPLETED && order.getCompletedAt() == null) {
                    order.setCompletedAt(Instant.now());
                }
                orderRepo.save(order);
                updated++;
            }
        }

        if (updated > 0) {
            log.info("Recomputed phases: {} order(s) updated", updated);
        }
    }
}
