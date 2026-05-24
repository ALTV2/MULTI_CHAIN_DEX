package com.multichain.dex.service;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.SwapPhase;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.OrderRepository;
import com.multichain.dex.indexer.BlockchainIndexer;
import com.multichain.dex.indexer.ChainScanner;
import com.multichain.dex.indexer.ChainScannerFactory;
import com.multichain.dex.kafka.OrderEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BlockchainIndexerTest {

    @Mock private ChainRepository chainRepo;
    @Mock private OrderRepository orderRepo;
    @Mock private ChainScannerFactory scannerFactory;
    @Mock private PhaseCalculator phaseCalculator;
    @Mock private ChainScanner chainScanner;
    @Mock private OrderEventPublisher eventPublisher;

    @InjectMocks private BlockchainIndexer indexer;

    private Chain sepolia;

    @BeforeEach
    void setUp() {
        sepolia = TestDataBuilder.sepolia();
    }

    @Test
    void processChain_scansOrdersAndHtlcs() {
        when(scannerFactory.getScanner(any())).thenReturn(chainScanner);
        when(orderRepo.findByPhaseNotIn(any())).thenReturn(List.of());

        indexer.processChain(sepolia);

        verify(chainScanner).scanOrders(sepolia);
        verify(chainScanner).scanHtlcs(sepolia);
        verify(chainRepo).save(any(Chain.class));
    }

    @Test
    void processChain_setsLastPolledAt() {
        when(scannerFactory.getScanner(any())).thenReturn(chainScanner);
        when(orderRepo.findByPhaseNotIn(any())).thenReturn(List.of());

        indexer.processChain(sepolia);

        verify(chainRepo).save(argThat(chain -> chain.getLastPolledAt() != null));
    }

    @Test
    void processChain_scannerException_doesNotPropagate() {
        when(scannerFactory.getScanner(any())).thenReturn(chainScanner);
        doThrow(new RuntimeException("RPC down")).when(chainScanner).scanOrders(any());

        // Should not throw
        indexer.processChain(sepolia);
    }

    @Test
    void init_noEnabledChains_doesNothing() {
        when(chainRepo.findByPollingEnabledTrue()).thenReturn(List.of());
        indexer.init();
        verifyNoInteractions(scannerFactory);
    }

    @Test
    void recomputePhases_updatesNonTerminalOrders() {
        Token tka = TestDataBuilder.tka(sepolia);
        Token tkb = TestDataBuilder.tkb(sepolia);
        Order order = TestDataBuilder.matchedOrder(sepolia, TestDataBuilder.polygon(), tka, tkb);
        order.setPhase(SwapPhase.ORDER_MATCHED);

        when(orderRepo.findByPhaseNotIn(any())).thenReturn(List.of(order));
        when(phaseCalculator.compute(order)).thenReturn(SwapPhase.CREATOR_HTLC_CREATED);

        indexer.recomputePhases();

        verify(orderRepo).save(argThat(o -> o.getPhase() == SwapPhase.CREATOR_HTLC_CREATED));
    }

    @Test
    void recomputePhases_noChange_doesNotSave() {
        Token tka = TestDataBuilder.tka(sepolia);
        Token tkb = TestDataBuilder.tkb(sepolia);
        Order order = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        order.setPhase(SwapPhase.ORDER_CREATED);

        when(orderRepo.findByPhaseNotIn(any())).thenReturn(List.of(order));
        when(phaseCalculator.compute(order)).thenReturn(SwapPhase.ORDER_CREATED); // no change

        indexer.recomputePhases();

        verify(orderRepo, never()).save(any());
    }

    @Test
    void recomputePhases_setsCompletedAt() {
        Token tka = TestDataBuilder.tka(sepolia);
        Token tkb = TestDataBuilder.tkb(sepolia);
        Order order = TestDataBuilder.matchedOrder(sepolia, TestDataBuilder.polygon(), tka, tkb);
        order.setPhase(SwapPhase.SECRET_REVEALED);

        when(orderRepo.findByPhaseNotIn(any())).thenReturn(List.of(order));
        when(phaseCalculator.compute(order)).thenReturn(SwapPhase.COMPLETED);

        indexer.recomputePhases();

        verify(orderRepo).save(argThat(o ->
                o.getPhase() == SwapPhase.COMPLETED && o.getCompletedAt() != null));
    }
}
