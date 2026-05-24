package com.multichain.dex.kafka.event;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OrderPhaseEventTest {

    private OrderPhaseEvent sample() {
        return new OrderPhaseEvent(
                "id-1", "11155111", "10", "CROSS_CHAIN", "ORDER_MATCHED",
                "alice@example.com", "bob@example.com", "0xcreator", "0xmatcher",
                "TKA", "1000", "TKB", "2000", "Ethereum (Sepolia)", "Polygon (Amoy)"
        );
    }

    @Test
    void exposesAllComponents() {
        OrderPhaseEvent e = sample();
        assertThat(e.orderId()).isEqualTo("id-1");
        assertThat(e.sourceChainId()).isEqualTo("11155111");
        assertThat(e.onChainOrderId()).isEqualTo("10");
        assertThat(e.orderType()).isEqualTo("CROSS_CHAIN");
        assertThat(e.phase()).isEqualTo("ORDER_MATCHED");
        assertThat(e.creatorEmail()).isEqualTo("alice@example.com");
        assertThat(e.matcherEmail()).isEqualTo("bob@example.com");
        assertThat(e.creatorAddress()).isEqualTo("0xcreator");
        assertThat(e.matcherAddress()).isEqualTo("0xmatcher");
        assertThat(e.sellSymbol()).isEqualTo("TKA");
        assertThat(e.sellAmount()).isEqualTo("1000");
        assertThat(e.buySymbol()).isEqualTo("TKB");
        assertThat(e.buyAmount()).isEqualTo("2000");
        assertThat(e.sourceChainName()).isEqualTo("Ethereum (Sepolia)");
        assertThat(e.targetChainName()).isEqualTo("Polygon (Amoy)");
    }

    @Test
    void valueSemanticsForEqualsHashCodeToString() {
        OrderPhaseEvent a = sample();
        OrderPhaseEvent b = sample();
        assertThat(a).isEqualTo(b).hasSameHashCodeAs(b);
        assertThat(a.toString()).contains("ORDER_MATCHED", "id-1");
    }
}
