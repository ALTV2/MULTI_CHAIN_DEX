package com.multichain.dex.service;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.*;
import com.multichain.dex.domain.enums.*;
import com.multichain.dex.dto.SwapResponse;
import com.multichain.dex.repository.HtlcSwapRepository;
import com.multichain.dex.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SwapQueryServiceTest {

    @Mock private OrderRepository orderRepo;
    @Mock private HtlcSwapRepository htlcRepo;
    @InjectMocks private SwapQueryService service;

    private Chain sepolia, polygon;
    private Token eth, tka, tkb;

    @BeforeEach
    void setUp() {
        sepolia = TestDataBuilder.sepolia();
        polygon = TestDataBuilder.polygon();
        eth = TestDataBuilder.eth(sepolia);
        tka = TestDataBuilder.tka(sepolia);
        tkb = TestDataBuilder.tkb(sepolia);
    }

    @Test
    void findActiveSwaps_emptyWallets_returnsEmpty() {
        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of());
        var result = service.findActiveSwaps(List.of("0xabc"));
        assertThat(result).isEmpty();
    }

    @Test
    void findActiveSwaps_creatorRole_detected() {
        Order order = TestDataBuilder.matchedOrder(sepolia, polygon, tka, tkb);
        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of(order));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.empty());
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        var result = service.findActiveSwaps(List.of(TestDataBuilder.CREATOR_ADDR));
        assertThat(result).hasSize(1);
        assertThat(result.get(0).role()).isEqualTo("creator");
    }

    @Test
    void findActiveSwaps_matcherRole_detected() {
        Order order = TestDataBuilder.matchedOrder(sepolia, polygon, tka, tkb);
        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of(order));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.empty());
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        var result = service.findActiveSwaps(List.of(TestDataBuilder.MATCHER_ADDR));
        assertThat(result).hasSize(1);
        assertThat(result.get(0).role()).isEqualTo("matcher");
    }

    @Test
    void findActiveSwaps_withHtlcDetails() {
        Order order = TestDataBuilder.matchedOrder(sepolia, polygon, tka, tkb);
        HtlcSwap creatorHtlc = TestDataBuilder.activeHtlc(order, HtlcRole.CREATOR, sepolia);
        creatorHtlc.setToken(tka);
        HtlcSwap matcherHtlc = TestDataBuilder.activeHtlc(order, HtlcRole.MATCHER, polygon);
        matcherHtlc.setToken(tkb);

        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of(order));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        var result = service.findActiveSwaps(List.of(TestDataBuilder.CREATOR_ADDR));
        assertThat(result).hasSize(1);

        SwapResponse swap = result.get(0);
        assertThat(swap.creatorHtlc()).isNotNull();
        assertThat(swap.creatorHtlc().status()).isEqualTo("ACTIVE");
        assertThat(swap.matcherHtlc()).isNotNull();
        assertThat(swap.matcherHtlc().status()).isEqualTo("ACTIVE");
        assertThat(swap.revealedSecret()).isNull();
    }

    @Test
    void findActiveSwaps_secretRevealed() {
        Order order = TestDataBuilder.matchedOrder(sepolia, polygon, tka, tkb);
        HtlcSwap creatorHtlc = TestDataBuilder.activeHtlc(order, HtlcRole.CREATOR, sepolia);
        creatorHtlc.setToken(tka);
        HtlcSwap matcherHtlc = TestDataBuilder.withdrawnHtlc(order, HtlcRole.MATCHER, polygon);
        matcherHtlc.setToken(tkb);

        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of(order));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        var result = service.findActiveSwaps(List.of(TestDataBuilder.CREATOR_ADDR));
        assertThat(result.get(0).revealedSecret()).isNotNull();
    }

    @Test
    void findActiveSwaps_multipleWallets_findsAll() {
        Order order1 = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        order1.setCreator(TestDataBuilder.CREATOR_ADDR);

        Order order2 = TestDataBuilder.matchedOrder(sepolia, polygon, tka, tkb);
        order2.setCreator("0xother");
        order2.setMatcher(TestDataBuilder.MATCHER_ADDR);

        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of(order1, order2));
        when(htlcRepo.findByOrderIdAndRole(any(), any())).thenReturn(Optional.empty());

        var result = service.findActiveSwaps(
                List.of(TestDataBuilder.CREATOR_ADDR, TestDataBuilder.MATCHER_ADDR));
        assertThat(result).hasSize(2);
    }

    @Test
    void findActiveSwaps_nullHtlcs_handledGracefully() {
        Order order = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        when(orderRepo.findActiveByWallets(any(), any())).thenReturn(List.of(order));
        when(htlcRepo.findByOrderIdAndRole(any(), any())).thenReturn(Optional.empty());

        var result = service.findActiveSwaps(List.of(TestDataBuilder.CREATOR_ADDR));
        assertThat(result).hasSize(1);
        assertThat(result.get(0).creatorHtlc()).isNull();
        assertThat(result.get(0).matcherHtlc()).isNull();
    }
}
