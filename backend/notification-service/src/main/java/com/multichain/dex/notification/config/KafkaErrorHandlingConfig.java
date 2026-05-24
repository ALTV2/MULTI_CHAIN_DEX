package com.multichain.dex.notification.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * Wires a {@link DefaultErrorHandler} that retries the failing record a few times
 * with backoff, then publishes it to a dead-letter topic ({@code <topic>.DLT})
 * so the main consumer can advance past poison messages.
 */
@Slf4j
@Configuration
public class KafkaErrorHandlingConfig {

    /** Retry 3 times with 5-second backoff before giving up. */
    private static final long RETRY_INTERVAL_MS = 5_000L;
    private static final long RETRY_ATTEMPTS = 3L;

    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<Object, Object> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaTemplate,
                (record, ex) -> {
                    log.error("Routing record to DLT after exhausted retries: topic={} offset={} key={}",
                            record.topic(), record.offset(), record.key(), ex);
                    return new org.apache.kafka.common.TopicPartition(record.topic() + ".DLT", record.partition());
                }
        );

        return new DefaultErrorHandler(recoverer, new FixedBackOff(RETRY_INTERVAL_MS, RETRY_ATTEMPTS));
    }
}
