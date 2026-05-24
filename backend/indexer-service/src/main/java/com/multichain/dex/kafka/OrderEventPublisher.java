package com.multichain.dex.kafka;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.kafka.event.OrderPhaseEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes order phase-change events to the notification service via Kafka.
 *
 * <p>Best-effort: a Kafka failure must never break the indexing transaction, so all
 * errors are swallowed and logged. Events are only published when at least one party
 * has opted in for notifications (a non-null email on the order).</p>
 *
 * <p>Must be called inside the indexing transaction so that lazy {@link Order} relations
 * (tokens, chains) are loaded while building the event.</p>
 */
@Slf4j
@Component
public class OrderEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public OrderEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                               @Value("${notifications.kafka.topic:dex.orders}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void publishPhaseChange(Order order) {
        try {
            if (order.getCreatorEmail() == null && order.getMatcherEmail() == null) {
                return; // no opted-in recipients — nothing to notify
            }

            OrderPhaseEvent event = new OrderPhaseEvent(
                    order.getId() != null ? order.getId().toString() : null,
                    order.getSourceChainId(),
                    order.getOnChainOrderId(),
                    order.getOrderType() != null ? order.getOrderType().name() : null,
                    order.getPhase() != null ? order.getPhase().name() : null,
                    order.getCreatorEmail(),
                    order.getMatcherEmail(),
                    order.getCreatorSourceAddress(),
                    order.getMatcherSourceAddress(),
                    order.getSellToken() != null ? order.getSellToken().getSymbol() : null,
                    order.getSellAmount() != null ? order.getSellAmount().toString() : null,
                    order.getBuyToken() != null ? order.getBuyToken().getSymbol() : null,
                    order.getBuyAmount() != null ? order.getBuyAmount().toString() : null,
                    order.getSourceChain() != null ? order.getSourceChain().getName() : null,
                    order.getTargetChain() != null ? order.getTargetChain().getName() : null
            );

            kafkaTemplate.send(topic, event.orderId(), event).whenComplete((res, ex) -> {
                if (ex != null) {
                    log.warn("Failed to publish order phase event for {}: {}", event.orderId(), ex.toString());
                } else {
                    log.debug("Published phase event order={} phase={}", event.orderId(), event.phase());
                }
            });
        } catch (Exception e) {
            log.warn("Skipping phase event publication: {}", e.toString());
        }
    }
}
