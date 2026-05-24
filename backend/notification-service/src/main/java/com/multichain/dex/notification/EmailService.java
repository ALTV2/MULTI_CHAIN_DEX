package com.multichain.dex.notification;

import com.multichain.dex.notification.event.OrderPhaseEvent;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

import java.util.ArrayList;
import java.util.List;

/**
 * Renders a phase-specific HTML email (Thymeleaf) and delivers it via SMTP to the
 * opted-in parties of an order.
 *
 * <p>Retryable transport errors (SMTP server unreachable, etc.) are rethrown so the
 * Kafka error handler can retry / DLT the record. Non-retryable per-recipient errors
 * (bad address, template render failure for one user) are logged and skipped.</p>
 */
@Slf4j
@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final ITemplateEngine templateEngine;
    private final String from;

    public EmailService(JavaMailSender mailSender,
                        ITemplateEngine templateEngine,
                        @Value("${notifications.mail.from:noreply@multichain-dex.local}") String from) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.from = from;
    }

    public void sendPhaseUpdate(OrderPhaseEvent event) {
        List<String> recipients = recipientsFor(event);
        if (recipients.isEmpty()) {
            log.debug("No opted-in recipients for order {} — skipping", event.orderId());
            return;
        }
        String subject = subjectFor(event.phase());
        String html = render(event, subject);

        for (String to : recipients) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
                helper.setFrom(from);
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(html, true);
                mailSender.send(message);
                log.info("Sent '{}' notification for order {} to {}", event.phase(), event.orderId(), to);
            } catch (org.springframework.mail.MailSendException e) {
                // Transport-level failure (SMTP down, connection refused) — rethrow so the
                // Kafka error handler retries the whole record and eventually DLT-routes it.
                throw new RuntimeException("SMTP transport failure for order " + event.orderId(), e);
            } catch (Exception e) {
                // Per-recipient non-retryable error (bad address, template issue) — log only.
                log.warn("Failed to send notification for order {} to {}: {}", event.orderId(), to, e.toString());
            }
        }
    }

    /** Render the email body. Package-visible for unit testing without SMTP/Kafka. */
    String render(OrderPhaseEvent event, String subject) {
        Context ctx = new Context();
        ctx.setVariable("event", event);
        ctx.setVariable("subject", subject);
        return templateEngine.process("email/phase-update", ctx);
    }

    private List<String> recipientsFor(OrderPhaseEvent event) {
        List<String> recipients = new ArrayList<>();
        if (event.creatorEmail() != null && !event.creatorEmail().isBlank()) recipients.add(event.creatorEmail());
        if (event.matcherEmail() != null && !event.matcherEmail().isBlank()) recipients.add(event.matcherEmail());
        return recipients;
    }

    /** Human-readable subject for each protocol phase. */
    static String subjectFor(String phase) {
        if (phase == null) return "Order status updated";
        return switch (phase) {
            case "ORDER_MATCHED" -> "Your order was matched";
            case "CREATOR_HTLC_CREATED" -> "Funds locked — counterparty action required";
            case "MATCHER_HTLC_CREATED" -> "Counterparty locked funds — reveal the secret to proceed";
            case "SECRET_REVEALED" -> "Secret revealed — claim your funds";
            case "COMPLETED" -> "Swap completed";
            case "REFUNDABLE" -> "Timelock expired — funds can be refunded";
            case "REFUNDED" -> "Funds refunded";
            default -> "Order status updated";
        };
    }
}
