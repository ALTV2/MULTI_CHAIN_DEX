package com.multichain.dex.service;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.dto.OrderResponse;
import com.multichain.dex.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepo;
    @InjectMocks private OrderService service;

    private Chain sepolia, polygon;
    private Token tka, tkb;

    @BeforeEach
    void setUp() {
        sepolia = TestDataBuilder.sepolia();
        polygon = TestDataBuilder.polygon();
        tka = TestDataBuilder.tka(sepolia);
        tkb = TestDataBuilder.tkb(sepolia);
    }

    @Test
    void findOrders_defaultActive_returnsPage() {
        Order order = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(order)));

        var result = service.findOrders(
                Set.of(OrderStatus.ACTIVE), null, null, null, null, null,
                PageRequest.of(0, 50));

        assertThat(result.getContent()).hasSize(1);
        OrderResponse resp = result.getContent().get(0);
        assertThat(resp.status()).isEqualTo("ACTIVE");
        assertThat(resp.orderType()).isEqualTo("SAME_CHAIN");
        assertThat(resp.sellToken().symbol()).isEqualTo("TKA");
        assertThat(resp.buyToken().symbol()).isEqualTo("TKB");
    }

    @Test
    void findOrders_formattedAmounts() {
        Order order = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(order)));

        var result = service.findOrders(
                Set.of(OrderStatus.ACTIVE), null, null, null, null, null,
                PageRequest.of(0, 50));

        OrderResponse resp = result.getContent().get(0);
        // 1000000000000000000 raw / 10^18 = 1.0
        assertThat(resp.formattedSellAmount()).isEqualTo("1");
        // 500000000000000000 raw / 10^18 = 0.5
        assertThat(resp.formattedBuyAmount()).isEqualTo("0.5");
    }

    @Test
    void findOrders_crossChain_includesTargetChain() {
        Token pTkb = TestDataBuilder.tkb(polygon);
        Order order = TestDataBuilder.crossChainOrder(sepolia, polygon, tka, pTkb);
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(order)));

        var result = service.findOrders(
                null, null, null, OrderType.CROSS_CHAIN, null, null,
                PageRequest.of(0, 50));

        OrderResponse resp = result.getContent().get(0);
        assertThat(resp.orderType()).isEqualTo("CROSS_CHAIN");
        assertThat(resp.targetChainId()).isEqualTo(TestDataBuilder.POLYGON_ID);
    }

    @Test
    void findMyOrders_byCreator() {
        Order order = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(order)));

        var result = service.findMyOrders(
                List.of(TestDataBuilder.CREATOR_ADDR), null, "creator",
                PageRequest.of(0, 50));

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void findMyOrders_byMatcher_emptyWhenNoMatch() {
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        var result = service.findMyOrders(
                List.of(TestDataBuilder.CREATOR_ADDR), null, "matcher",
                PageRequest.of(0, 50));

        assertThat(result.getContent()).isEmpty();
    }

    @Test
    void findMyOrders_walletsCaseInsensitive() {
        Order order = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(order)));

        // Uppercase wallet should still match
        var result = service.findMyOrders(
                List.of(TestDataBuilder.CREATOR_ADDR.toUpperCase()),
                null, null, PageRequest.of(0, 50));

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void findOrders_emptyResult() {
        when(orderRepo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        var result = service.findOrders(
                Set.of(OrderStatus.ACTIVE), "99999", null, null, null, null,
                PageRequest.of(0, 50));

        assertThat(result.getContent()).isEmpty();
        assertThat(result.getTotalElements()).isZero();
    }
}
