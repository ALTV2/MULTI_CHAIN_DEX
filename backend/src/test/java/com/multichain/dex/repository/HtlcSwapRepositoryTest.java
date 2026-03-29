package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class HtlcSwapRepositoryTest {

    @Autowired private TestEntityManager em;
    @Autowired private HtlcSwapRepository htlcRepo;

    private Chain sepolia;
    private Chain polygon;
    private Order order;

    @BeforeEach
    void setUp() {
        sepolia = em.persist(Chain.builder()
                .id("11155111").name("Sepolia").shortName("ETH")
                .chainType(ChainType.EVM).rpcUrl("http://t")
                .nativeSymbol("ETH").nativeDecimals(18)
                .contracts(Map.of("htlc", "0x1")).build());

        polygon = em.persist(Chain.builder()
                .id("80002").name("Polygon").shortName("POL")
                .chainType(ChainType.EVM).rpcUrl("http://t2")
                .nativeSymbol("MATIC").nativeDecimals(18)
                .contracts(Map.of("htlc", "0x2")).build());

        Token tka = em.persist(Token.builder()
                .chain(sepolia).address("0xTKA").symbol("TKA").decimals(18).build());
        Token tkb = em.persist(Token.builder()
                .chain(polygon).address("0xTKB").symbol("TKB").decimals(18).build());

        order = em.persist(Order.builder()
                .sourceChain(sepolia).onChainOrderId("10")
                .orderType(OrderType.CROSS_CHAIN)
                .creator("0xcreator").matcher("0xmatcher")
                .sellToken(tka).sellAmount(BigInteger.ONE)
                .buyToken(tkb).buyAmount(BigInteger.ONE)
                .targetChain(polygon)
                .status(OrderStatus.MATCHED).phase(SwapPhase.ORDER_MATCHED)
                .build());

        em.flush();
    }

    @Test
    void findByOrderIdAndRole_creator() {
        em.persist(htlc(HtlcRole.CREATOR, sepolia, HtlcStatus.ACTIVE, "0xhash1"));
        em.flush();

        var found = htlcRepo.findByOrderIdAndRole(order.getId(), HtlcRole.CREATOR);
        assertThat(found).isPresent();
        assertThat(found.get().getInitiator()).isEqualTo("0xcreator");
    }

    @Test
    void findByOrderIdAndRole_matcher() {
        em.persist(htlc(HtlcRole.MATCHER, polygon, HtlcStatus.ACTIVE, "0xhash2"));
        em.flush();

        var found = htlcRepo.findByOrderIdAndRole(order.getId(), HtlcRole.MATCHER);
        assertThat(found).isPresent();
        assertThat(found.get().getChain().getId()).isEqualTo("80002");
    }

    @Test
    void findByOrderId_returnsBoth() {
        em.persist(htlc(HtlcRole.CREATOR, sepolia, HtlcStatus.ACTIVE, "0xhashA"));
        em.persist(htlc(HtlcRole.MATCHER, polygon, HtlcStatus.ACTIVE, "0xhashB"));
        em.flush();

        var list = htlcRepo.findByOrderId(order.getId());
        assertThat(list).hasSize(2);
    }

    @Test
    void findByChainIdAndStatus_onlyActive() {
        em.persist(htlc(HtlcRole.CREATOR, sepolia, HtlcStatus.ACTIVE, "0xhashC"));
        em.persist(htlc(HtlcRole.MATCHER, polygon, HtlcStatus.WITHDRAWN, "0xhashD"));
        em.flush();

        var active = htlcRepo.findByChainIdAndStatus("11155111", HtlcStatus.ACTIVE);
        assertThat(active).hasSize(1);

        var withdrawn = htlcRepo.findByChainIdAndStatus("80002", HtlcStatus.WITHDRAWN);
        assertThat(withdrawn).hasSize(1);
    }

    @Test
    void findByOnChainSwapId() {
        HtlcSwap h = em.persist(htlc(HtlcRole.CREATOR, sepolia, HtlcStatus.ACTIVE, "0xunique"));
        h.setOnChainSwapId("0xswap123");
        em.flush();

        var found = htlcRepo.findByOnChainSwapId("0xswap123");
        assertThat(found).isPresent();
    }

    @Test
    void findBySuiObjectId() {
        HtlcSwap h = em.persist(htlc(HtlcRole.MATCHER, polygon, HtlcStatus.ACTIVE, "0xhashE"));
        h.setSuiObjectId("0xsuiobj123");
        em.flush();

        var found = htlcRepo.findBySuiObjectId("0xsuiobj123");
        assertThat(found).isPresent();
    }

    @Test
    void findByHashlockAndChainIdAndRole() {
        em.persist(htlc(HtlcRole.CREATOR, sepolia, HtlcStatus.ACTIVE, "0xspecialhash"));
        em.flush();

        var found = htlcRepo.findByHashlockAndChainIdAndRole("0xspecialhash", "11155111", HtlcRole.CREATOR);
        assertThat(found).isPresent();

        var notFound = htlcRepo.findByHashlockAndChainIdAndRole("0xspecialhash", "80002", HtlcRole.CREATOR);
        assertThat(notFound).isEmpty();
    }

    private HtlcSwap htlc(HtlcRole role, Chain chain, HtlcStatus status, String hashlock) {
        return HtlcSwap.builder()
                .order(order).role(role).chain(chain)
                .initiator("0xcreator").participant("0xmatcher")
                .hashlock(hashlock)
                .timelock(Instant.now().plusSeconds(86400))
                .status(status)
                .build();
    }
}
