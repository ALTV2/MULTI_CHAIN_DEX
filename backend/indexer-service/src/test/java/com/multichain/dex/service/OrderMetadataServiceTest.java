package com.multichain.dex.service;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.dto.OrderMetadataRequest;
import com.multichain.dex.indexer.BlockchainIndexer;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderMetadataServiceTest {

    @Mock private OrderRepository orderRepo;
    @Mock private ChainRepository chainRepo;
    @Mock private BlockchainIndexer indexer;

    private OrderMetadataService service;

    @BeforeEach
    void setUp() {
        service = new OrderMetadataService(orderRepo, chainRepo, indexer);
    }

    private OrderMetadataRequest req(String role, String target, String email) {
        return new OrderMetadataRequest("11155111", "5", "CROSS_CHAIN", role, target, email);
    }

    @Test
    void attach_orderFound_setsCreatorFields() {
        Order order = Order.builder().orderType(OrderType.CROSS_CHAIN).build();
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("11155111", "5", OrderType.CROSS_CHAIN))
                .thenReturn(Optional.of(order));

        boolean ok = service.attach(req("creator", "0xFULLSUIADDR", "a@x.io"));

        assertThat(ok).isTrue();
        assertThat(order.getCreatorTargetAddress()).isEqualTo("0xFULLSUIADDR");
        assertThat(order.getCreatorEmail()).isEqualTo("a@x.io");
        verify(orderRepo).save(order);
        verifyNoInteractions(indexer);
    }

    @Test
    void attach_matcherRole_setsMatcherFields() {
        Order order = Order.builder().orderType(OrderType.CROSS_CHAIN).build();
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType(any(), any(), any()))
                .thenReturn(Optional.of(order));

        boolean ok = service.attach(req("matcher", "0xMATCHERSUI", "m@x.io"));

        assertThat(ok).isTrue();
        assertThat(order.getMatcherTargetAddress()).isEqualTo("0xMATCHERSUI");
        assertThat(order.getMatcherEmail()).isEqualTo("m@x.io");
    }

    @Test
    void attach_orderNotIndexedYet_forcesIndexingThenAttaches() {
        Order order = Order.builder().orderType(OrderType.CROSS_CHAIN).build();
        Chain sepolia = TestDataBuilder.sepolia();
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType(any(), any(), any()))
                .thenReturn(Optional.empty())     // not indexed yet
                .thenReturn(Optional.of(order));   // after forced indexing
        when(chainRepo.findById("11155111")).thenReturn(Optional.of(sepolia));

        boolean ok = service.attach(req("creator", "0xLATE", "late@x.io"));

        assertThat(ok).isTrue();
        verify(indexer).processChain(sepolia);
        assertThat(order.getCreatorTargetAddress()).isEqualTo("0xLATE");
        verify(orderRepo).save(order);
    }

    @Test
    void attach_orderNeverFound_returnsFalse() {
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(chainRepo.findById(any())).thenReturn(Optional.of(TestDataBuilder.sepolia()));

        boolean ok = service.attach(req("creator", "0xX", "x@x.io"));

        assertThat(ok).isFalse();
        verify(orderRepo, never()).save(any());
    }
}
