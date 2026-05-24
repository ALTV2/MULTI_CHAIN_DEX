package com.multichain.dex.service;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.*;
import com.multichain.dex.repository.HtlcSwapRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PhaseCalculatorTest {

    @Mock
    private HtlcSwapRepository htlcRepo;

    @InjectMocks
    private PhaseCalculator calculator;

    private Order order;

    @BeforeEach
    void setUp() {
        Chain chain = Chain.builder().id("11155111").name("Sepolia").shortName("Ethereum")
                .chainType(ChainType.EVM).rpcUrl("http://test").nativeSymbol("ETH").nativeDecimals(18).build();
        Token token = Token.builder().id(UUID.randomUUID()).chain(chain).address("0x1").symbol("TKA")
                .decimals(18).build();

        order = Order.builder()
                .id(UUID.randomUUID())
                .sourceChain(chain)
                .onChainOrderId("1")
                .orderType(OrderType.CROSS_CHAIN)
                .creatorSourceAddress("0xCreator")
                .sellToken(token)
                .sellAmount(BigInteger.valueOf(1000))
                .buyToken(token)
                .buyAmount(BigInteger.valueOf(500))
                .status(OrderStatus.ACTIVE)
                .phase(SwapPhase.ORDER_CREATED)
                .build();
    }

    @Test
    void orderCreated_noMatcherNoHtlcs() {
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.empty());
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.ORDER_CREATED);
    }

    @Test
    void orderMatched_matcherSetNoHtlcs() {
        order.setMatcherSourceAddress("0xMatcher");
        order.setStatus(OrderStatus.MATCHED);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.empty());
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.ORDER_MATCHED);
    }

    @Test
    void creatorHtlcCreated_onlyCreatorLocked() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.ACTIVE);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.CREATOR_HTLC_CREATED);
    }

    @Test
    void matcherHtlcCreated_bothLocked() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.ACTIVE);
        HtlcSwap matcherHtlc = buildHtlc(HtlcRole.MATCHER, HtlcStatus.ACTIVE);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.MATCHER_HTLC_CREATED);
    }

    @Test
    void secretRevealed_matcherWithdrawnCreatorActive() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.ACTIVE);
        HtlcSwap matcherHtlc = buildHtlc(HtlcRole.MATCHER, HtlcStatus.WITHDRAWN);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.SECRET_REVEALED);
    }

    @Test
    void secretRevealed_creatorWithdrawnMatcherActive_suiToEvmPattern() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.WITHDRAWN);
        HtlcSwap matcherHtlc = buildHtlc(HtlcRole.MATCHER, HtlcStatus.ACTIVE);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.SECRET_REVEALED);
    }

    @Test
    void completed_bothWithdrawn() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.WITHDRAWN);
        HtlcSwap matcherHtlc = buildHtlc(HtlcRole.MATCHER, HtlcStatus.WITHDRAWN);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.COMPLETED);
    }

    @Test
    void completed_orderStatusCompleted() {
        order.setStatus(OrderStatus.COMPLETED);
        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.COMPLETED);
    }

    @Test
    void refunded_orderCancelled() {
        order.setStatus(OrderStatus.CANCELLED);
        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.REFUNDED);
    }

    @Test
    void refunded_htlcRefunded() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.REFUNDED);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.REFUNDED);
    }

    @Test
    void refundable_htlcExpired() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap creatorHtlc = buildHtlc(HtlcRole.CREATOR, HtlcStatus.ACTIVE);
        creatorHtlc.setTimelock(Instant.now().minusSeconds(3600)); // expired 1 hour ago
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.of(creatorHtlc));
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.empty());

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.REFUNDABLE);
    }

    @Test
    void orderMatched_suiToEvm_onlyMatcherHtlcActive() {
        order.setMatcherSourceAddress("0xMatcher");
        HtlcSwap matcherHtlc = buildHtlc(HtlcRole.MATCHER, HtlcStatus.ACTIVE);
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.CREATOR))).thenReturn(Optional.empty());
        when(htlcRepo.findByOrderIdAndRole(any(), eq(HtlcRole.MATCHER))).thenReturn(Optional.of(matcherHtlc));

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.ORDER_MATCHED);
    }

    @Test
    void sameChain_completed() {
        order.setOrderType(OrderType.SAME_CHAIN);
        order.setExecutionTxHash("0xabc");

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.COMPLETED);
    }

    @Test
    void sameChain_matched() {
        order.setOrderType(OrderType.SAME_CHAIN);
        order.setMatcherSourceAddress("0xMatcher");

        assertThat(calculator.compute(order)).isEqualTo(SwapPhase.ORDER_MATCHED);
    }

    private HtlcSwap buildHtlc(HtlcRole role, HtlcStatus status) {
        return HtlcSwap.builder()
                .id(UUID.randomUUID())
                .order(order)
                .role(role)
                .chain(order.getSourceChain())
                .status(status)
                .initiator("0xInit")
                .participant("0xPart")
                .timelock(Instant.now().plusSeconds(86400)) // future timelock
                .build();
    }
}
