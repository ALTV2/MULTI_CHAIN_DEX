package com.multichain.dex.notification;

import com.multichain.dex.notification.event.OrderPhaseEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

/**
 * Consumes order phase-change events from Kafka and triggers email notifications.
 *
 * <p>Uses MANUAL_IMMEDIATE ack mode: offset is committed only after successful
 * email delivery. Transient SMTP failures cause a {@link RuntimeException}, which
 * the default error handler retries with backoff; after retries are exhausted
 * the record is published to the {@code dex.orders.DLT} topic and the offset is
 * advanced.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventListener {

    private final EmailService emailService;

    @KafkaListener(
            topics = "${notifications.kafka.topic:dex.orders}",
            groupId = "${spring.kafka.consumer.group-id:notification-service}"
    )
    public void onOrderPhase(OrderPhaseEvent event, Acknowledgment ack) {
        log.info("Received phase event: order={} phase={}", event.orderId(), event.phase());
        try {
            emailService.sendPhaseUpdate(event);
            ack.acknowledge();
        } catch (RuntimeException e) {
            // Do NOT acknowledge — error handler will retry or DLT-route the record.
            log.warn("Email delivery failed for order={} phase={} (will retry or DLT)",
                    event.orderId(), event.phase(), e);
            throw e;
        }
    }
}
