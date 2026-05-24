package com.multichain.dex.notification;

import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

/**
 * Standalone notification service: a DB-less Kafka consumer that turns order
 * phase-change events into email notifications. Runs as a non-web application.
 */
@SpringBootApplication
public class NotificationServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(NotificationServiceApplication.class)
                .web(WebApplicationType.NONE)
                .run(args);
    }
}
