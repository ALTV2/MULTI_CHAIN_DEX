package com.multichain.dex.kafka;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.kafka.event.OrderPhaseEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderEventPublisherTest {

    @Mock
    KafkaTemplate<String, Object> kafkaTemplate;

    private OrderEventPublisher publisher;
    private Chain sepolia;
    private Chain polygon;
    private Token tka;
    private Token tkb;

    @BeforeEach
    void setUp() {
        publisher = new OrderEventPublisher(kafkaTemplate, "dex.orders");
        sepolia = TestDataBuilder.sepolia();
        polygon = TestDataBuilder.polygon();
        tka = TestDataBuilder.tka(sepolia);
        tkb = TestDataBuilder.tkb(polygon);
    }

    @Test
    void doesNotPublishWhenNobodyOptedIn() {
        Order order = TestDataBuilder.crossChainOrder(sepolia, polygon, tka, tkb);
        publisher.publishPhaseChange(order);
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    void publishesEnrichedEventWhenCreatorOptedIn() {
        when(kafkaTemplate.send(anyString(), anyString(), any()))
                .thenReturn(CompletableFuture.completedFuture(null));

        Order order = TestDataBuilder.crossChainOrder(sepolia, polygon, tka, tkb);
        order.setCreatorEmail("alice@example.com");

        publisher.publishPhaseChange(order);

        ArgumentCaptor<OrderPhaseEvent> captor = ArgumentCaptor.forClass(OrderPhaseEvent.class);
        verify(kafkaTemplate).send(eq("dex.orders"), anyString(), captor.capture());
        OrderPhaseEvent e = captor.getValue();
        assertThat(e.creatorEmail()).isEqualTo("alice@example.com");
        assertThat(e.sourceChainId()).isEqualTo(TestDataBuilder.SEPOLIA_ID);
        assertThat(e.sellSymbol()).isEqualTo("TKA");
        assertThat(e.buySymbol()).isEqualTo("TKB");
        assertThat(e.sourceChainName()).isEqualTo("Ethereum (Sepolia)");
        assertThat(e.targetChainName()).isEqualTo("Polygon (Amoy)");
        assertThat(e.orderType()).isEqualTo("CROSS_CHAIN");
    }

    @Test
    void publishesWhenOnlyMatcherOptedIn() {
        when(kafkaTemplate.send(anyString(), anyString(), any()))
                .thenReturn(CompletableFuture.completedFuture(null));
        Order order = TestDataBuilder.crossChainOrder(sepolia, polygon, tka, tkb);
        order.setMatcherEmail("bob@example.com");
        publisher.publishPhaseChange(order);
        verify(kafkaTemplate).send(eq("dex.orders"), anyString(), any());
    }

    @Test
    void swallowsKafkaFailures() {
        when(kafkaTemplate.send(anyString(), anyString(), any()))
                .thenThrow(new RuntimeException("broker down"));
        Order order = TestDataBuilder.crossChainOrder(sepolia, polygon, tka, tkb);
        order.setCreatorEmail("alice@example.com");
        assertThatCode(() -> publisher.publishPhaseChange(order)).doesNotThrowAnyException();
    }
}
