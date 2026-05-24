package com.multichain.dex.indexer;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.SwapPhase;
import com.multichain.dex.kafka.OrderEventPublisher;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.OrderRepository;
import com.multichain.dex.service.PhaseCalculator;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Scheduled blockchain indexer. Polls each enabled chain independently at
 * a configured interval, upserts orders and HTLC data into the database,
 * and recomputes swap phases.
 *
 * <p>Each chain runs on its own scheduled thread with its own lock,
 * so a slow or failing chain does not block others.</p>
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
    private final OrderEventPublisher eventPublisher;

    @Value("${indexer.polling-interval:10000}")
    private long pollingInterval;

    /** Per-chain locks to prevent concurrent execution between polling and tx/notify. */
    private final ConcurrentHashMap<String, ReentrantLock> chainLocks = new ConcurrentHashMap<>();

    /** Lock for recomputePhases to avoid concurrent phase updates. */
    private final ReentrantLock phaseLock = new ReentrantLock();

    private ScheduledExecutorService scheduler;

    @PostConstruct
    public void init() {
        List<Chain> chains = chainRepo.findByPollingEnabledTrue();
        if (chains.isEmpty()) {
            log.info("No chains with polling enabled — indexer idle");
            return;
        }

        scheduler = Executors.newScheduledThreadPool(chains.size(), r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            t.setName("indexer-pool");
            return t;
        });

        for (Chain chain : chains) {
            chainLocks.put(chain.getId(), new ReentrantLock());
            scheduler.scheduleWithFixedDelay(
                    () -> pollChain(chain.getId()),
                    0, pollingInterval, TimeUnit.MILLISECONDS
            );
            log.info("Scheduled independent indexer for chain [{}] every {}ms",
                    chain.getId(), pollingInterval);
        }
    }

    @PreDestroy
    public void shutdown() {
        if (scheduler != null) {
            scheduler.shutdown();
            try {
                if (!scheduler.awaitTermination(30, TimeUnit.SECONDS)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }

    /**
     * Poll a single chain. Called by the per-chain scheduled task.
     * Skips if the previous cycle for this chain is still running.
     */
    private void pollChain(String chainId) {
        ReentrantLock lock = chainLocks.get(chainId);
        if (lock == null || !lock.tryLock()) {
            log.debug("[{}] Indexer cycle skipped — previous cycle still running", chainId);
            return;
        }
        try {
            Chain chain = chainRepo.findById(chainId).orElse(null);
            if (chain == null || !chain.isPollingEnabled()) return;

            long start = System.currentTimeMillis();

            ChainScanner scanner = scannerFactory.getScanner(chain);
            scanner.scanOrders(chain);
            scanner.scanHtlcs(chain);
            chain.setLastPolledAt(Instant.now());
            chainRepo.save(chain);

            recomputePhases();

            long elapsed = System.currentTimeMillis() - start;
            log.debug("[{}] Indexer cycle completed in {}ms", chainId, elapsed);
        } catch (Exception e) {
            log.error("[{}] Indexer cycle failed", chainId, e);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Process a single chain immediately (called from tx/notify).
     * Acquires the per-chain lock to prevent conflicts with polling.
     */
    public void processChain(Chain chain) {
        ReentrantLock lock = chainLocks.computeIfAbsent(chain.getId(), k -> new ReentrantLock());
        lock.lock();
        try {
            ChainScanner scanner = scannerFactory.getScanner(chain);
            scanner.scanOrders(chain);
            scanner.scanHtlcs(chain);
            chain.setLastPolledAt(Instant.now());
            chainRepo.save(chain);
            recomputePhases();
        } catch (Exception e) {
            log.error("[{}] Failed to process chain", chain.getId(), e);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Recompute phases for all non-terminal orders.
     * Uses a separate lock to avoid concurrent phase updates from parallel chain polls.
     */
    @Transactional
    public void recomputePhases() {
        phaseLock.lock();
        try {
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
                    // Notify (best-effort) — publishes only if a party opted in by email.
                    eventPublisher.publishPhaseChange(order);
                }
            }

            if (updated > 0) {
                log.info("Recomputed phases: {} order(s) updated", updated);
            }
        } finally {
            phaseLock.unlock();
        }
    }
}
