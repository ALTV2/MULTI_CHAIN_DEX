package com.multichain.dex.notification;

import com.multichain.dex.notification.event.OrderPhaseEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Email composition tests. Loads the Spring context (so the real Thymeleaf
 * SpringTemplateEngine is used) but disables the Kafka listener auto-startup,
 * so neither a Kafka broker nor an SMTP server is required.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.kafka.listener.auto-startup=false",
                "spring.kafka.bootstrap-servers=localhost:9092"
        }
)
class EmailServiceTest {

    @Autowired
    private EmailService emailService;

    private OrderPhaseEvent event(String phase, String creatorEmail, String matcherEmail) {
        return new OrderPhaseEvent("uuid-1", "11155111", "5", "CROSS_CHAIN", phase,
                creatorEmail, matcherEmail, "0xCreator", "0xMatcher",
                "TKA", "100", "MATIC", "5", "Ethereum (Sepolia)", "Polygon (Amoy)");
    }

    @Test
    void render_includesPhaseAmountsAndSubject() {
        String html = emailService.render(event("SECRET_REVEALED", "a@x.io", null), "Subject X");
        assertThat(html).contains("SECRET_REVEALED");
        assertThat(html).contains("TKA");
        assertThat(html).contains("MATIC");
        assertThat(html).contains("Subject X");
        assertThat(html).contains("Ethereum (Sepolia)");
    }

    @Test
    void sendPhaseUpdate_noRecipients_doesNotThrow() {
        assertThatCode(() -> emailService.sendPhaseUpdate(event("ORDER_MATCHED", null, null)))
                .doesNotThrowAnyException();
    }

    @Test
    void subjectFor_mapsKnownAndUnknownPhases() {
        assertThat(EmailService.subjectFor("COMPLETED")).isEqualTo("Swap completed");
        assertThat(EmailService.subjectFor("ORDER_MATCHED")).isEqualTo("Your order was matched");
        assertThat(EmailService.subjectFor("UNKNOWN_PHASE")).isEqualTo("Order status updated");
        assertThat(EmailService.subjectFor(null)).isEqualTo("Order status updated");
    }
}
