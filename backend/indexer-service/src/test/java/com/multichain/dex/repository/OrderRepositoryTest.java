package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.*;
import com.multichain.dex.service.OrderSpecifications;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigInteger;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class OrderRepositoryTest {

    @Autowired private TestEntityManager em;
    @Autowired private OrderRepository orderRepo;

    private Chain sepolia;
    private Chain polygon;
    private Token tka;
    private Token tkb;
    private Token pTka;

    @BeforeEach
    void setUp() {
        sepolia = em.persist(Chain.builder()
                .id("11155111").name("Sepolia").shortName("ETH")
                .chainType(ChainType.EVM).rpcUrl("http://test")
                .nativeSymbol("ETH").nativeDecimals(18)
                .contracts(Map.of("htlc", "0x1"))
                .build());

        polygon = em.persist(Chain.builder()
                .id("80002").name("Polygon").shortName("POL")
                .chainType(ChainType.EVM).rpcUrl("http://test2")
                .nativeSymbol("MATIC").nativeDecimals(18)
                .contracts(Map.of("htlc", "0x2"))
                .build());

        tka = em.persist(Token.builder()
                .chain(sepolia).address("0xTKA").symbol("TKA").decimals(18).build());
        tkb = em.persist(Token.builder()
                .chain(sepolia).address("0xTKB").symbol("TKB").decimals(18).build());
        pTka = em.persist(Token.builder()
                .chain(polygon).address("0xpTKA").symbol("pTKA").decimals(18).build());

        em.flush();
    }

    @Test
    void findBySourceChainAndOnChainOrderId() {
        em.persist(order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED));
        em.flush();

        var found = orderRepo.findBySourceChain_IdAndOnChainOrderId("11155111", "1");
        assertThat(found).isPresent();
        assertThat(found.get().getCreatorSourceAddress()).isEqualTo("0xcreator");
    }

    @Test
    void findBySourceChainAndOnChainOrderId_notFound() {
        var found = orderRepo.findBySourceChain_IdAndOnChainOrderId("11155111", "999");
        assertThat(found).isEmpty();
    }

    @Test
    void findByPhaseNotIn_excludesTerminal() {
        em.persist(order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED));
        em.persist(order("2", sepolia, OrderStatus.COMPLETED, SwapPhase.COMPLETED));
        em.persist(order("3", sepolia, OrderStatus.MATCHED, SwapPhase.ORDER_MATCHED));
        em.flush();

        var active = orderRepo.findByPhaseNotIn(Set.of(SwapPhase.COMPLETED, SwapPhase.REFUNDED));
        assertThat(active).hasSize(2);
        assertThat(active).extracting(Order::getOnChainOrderId).containsExactlyInAnyOrder("1", "3");
    }

    @Test
    void findByWallets_findsCreatorAndMatcher() {
        Order o1 = order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED);
        o1.setCreatorSourceAddress("0xalice");

        Order o2 = order("2", sepolia, OrderStatus.MATCHED, SwapPhase.ORDER_MATCHED);
        o2.setCreatorSourceAddress("0xbob");
        o2.setMatcherSourceAddress("0xalice");

        em.persist(o1);
        em.persist(o2);
        em.flush();

        var page = orderRepo.findByWallets(List.of("0xalice"), PageRequest.of(0, 50));
        assertThat(page.getContent()).hasSize(2);
    }

    @Test
    void findActiveByWallets_excludesTerminal() {
        Order active = order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED);
        active.setCreatorSourceAddress("0xalice");

        Order completed = order("2", sepolia, OrderStatus.COMPLETED, SwapPhase.COMPLETED);
        completed.setCreatorSourceAddress("0xalice");
        completed.setCompletedAt(Instant.now());

        em.persist(active);
        em.persist(completed);
        em.flush();

        var result = orderRepo.findActiveByWallets(
                List.of("0xalice"),
                Set.of(SwapPhase.COMPLETED, SwapPhase.REFUNDED));
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getOnChainOrderId()).isEqualTo("1");
    }

    @Test
    void findHistoryByWallets_onlyTerminal() {
        Order active = order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED);
        active.setCreatorSourceAddress("0xalice");

        Order completed = order("2", sepolia, OrderStatus.COMPLETED, SwapPhase.COMPLETED);
        completed.setCreatorSourceAddress("0xalice");
        completed.setCompletedAt(Instant.now());

        em.persist(active);
        em.persist(completed);
        em.flush();

        var page = orderRepo.findHistoryByWallets(
                List.of("0xalice"),
                Set.of(SwapPhase.COMPLETED, SwapPhase.REFUNDED),
                PageRequest.of(0, 50));
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getOnChainOrderId()).isEqualTo("2");
    }

    @Test
    void findByWallets_caseInsensitive() {
        Order o = order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED);
        o.setCreatorSourceAddress("0xAlIcE");
        em.persist(o);
        em.flush();

        var page = orderRepo.findByWallets(List.of("0xalice"), PageRequest.of(0, 50));
        assertThat(page.getContent()).hasSize(1);
    }

    @Test
    void uniqueConstraint_sourceChainAndOnChainOrderId() {
        em.persist(order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED));
        em.flush();

        // Same order ID on different chain — should work
        em.persist(order("1", polygon, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED));
        em.flush();

        assertThat(orderRepo.count()).isEqualTo(2);
    }

    @Test
    void orderSpecifications_executeAgainstDatabase() {
        // A: same-chain ACTIVE on sepolia, creator alice
        Order a = order("1", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_CREATED);
        a.setCreatorSourceAddress("0xALICE");
        // B: cross-chain ACTIVE sepolia→polygon, creator alice + matcher bob
        Order b = order("2", sepolia, OrderStatus.ACTIVE, SwapPhase.ORDER_MATCHED);
        b.setOrderType(OrderType.CROSS_CHAIN);
        b.setTargetChain(polygon);
        b.setCreatorSourceAddress("0xALICE");
        b.setMatcherSourceAddress("0xBOB");
        // C: same-chain CANCELLED on polygon, creator carol
        Order c = order("3", polygon, OrderStatus.CANCELLED, SwapPhase.REFUNDED);
        c.setCreatorSourceAddress("0xCAROL");
        em.persist(a); em.persist(b); em.persist(c); em.flush();

        // Status filter (and the empty-set → null branch = no restriction)
        assertThat(orderRepo.findAll(OrderSpecifications.hasStatusIn(Set.of(OrderStatus.ACTIVE)))).hasSize(2);
        assertThat(orderRepo.findAll(OrderSpecifications.hasStatusIn(Set.of()))).hasSize(3);
        // Chain filters
        assertThat(orderRepo.findAll(OrderSpecifications.hasSourceChain("11155111"))).hasSize(2);
        assertThat(orderRepo.findAll(OrderSpecifications.hasTargetChain("80002"))).hasSize(1);
        // Order type
        assertThat(orderRepo.findAll(OrderSpecifications.hasOrderType(OrderType.CROSS_CHAIN))).hasSize(1);
        // Token by symbol (case-insensitive) and by 0x-address
        assertThat(orderRepo.findAll(OrderSpecifications.sellTokenMatches("tka"))).hasSize(2);
        assertThat(orderRepo.findAll(OrderSpecifications.buyTokenMatches("TKB"))).hasSize(2);
        assertThat(orderRepo.findAll(OrderSpecifications.sellTokenMatches("0xpTKA"))).hasSize(1);
        // Participant wallet (creator / matcher / either)
        assertThat(orderRepo.findAll(OrderSpecifications.hasParticipantWallet(List.of("0xalice"), "creator"))).hasSize(2);
        assertThat(orderRepo.findAll(OrderSpecifications.hasParticipantWallet(List.of("0xbob"), "matcher"))).hasSize(1);
        assertThat(orderRepo.findAll(OrderSpecifications.hasParticipantWallet(List.of("0xalice", "0xcarol"), "either"))).hasSize(3);
        // Null filters are inert (return null predicate)
        assertThat(orderRepo.findAll(OrderSpecifications.hasSourceChain(null))).hasSize(3);
        assertThat(orderRepo.findAll(OrderSpecifications.sellTokenMatches(null))).hasSize(3);
    }

    private Order order(String onChainId, Chain chain, OrderStatus status, SwapPhase phase) {
        Token sell = chain.getId().equals("11155111") ? tka : pTka;
        Token buy = chain.getId().equals("11155111") ? tkb : pTka;
        return Order.builder()
                .sourceChain(chain)
                .onChainOrderId(onChainId)
                .orderType(OrderType.SAME_CHAIN)
                .creatorSourceAddress("0xcreator")
                .sellToken(sell).sellAmount(BigInteger.ONE)
                .buyToken(buy).buyAmount(BigInteger.ONE)
                .status(status).phase(phase)
                .build();
    }
}
