package com.multichain.dex.notification;

import com.multichain.dex.notification.event.OrderPhaseEvent;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.thymeleaf.ITemplateEngine;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the SMTP delivery path of {@link EmailService} with a mocked
 * {@link JavaMailSender}, so neither a Spring context nor a mail server is needed.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceSendTest {

    @Mock private JavaMailSender mailSender;
    @Mock private ITemplateEngine templateEngine;

    private EmailService service;

    @BeforeEach
    void setUp() {
        service = new EmailService(mailSender, templateEngine, "noreply@test.local");
    }

    private OrderPhaseEvent event(String creatorEmail, String matcherEmail) {
        return new OrderPhaseEvent("uuid-1", "11155111", "5", "CROSS_CHAIN", "SECRET_REVEALED",
                creatorEmail, matcherEmail, "0xCreator", "0xMatcher",
                "TKA", "100", "MATIC", "5", "Ethereum (Sepolia)", "Polygon (Amoy)");
    }

    @Test
    void sendsOneMessagePerOptedInParty() {
        when(templateEngine.process(anyString(), any())).thenReturn("<html>body</html>");
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage((jakarta.mail.Session) null));

        service.sendPhaseUpdate(event("alice@example.com", "bob@example.com"));

        verify(mailSender, times(2)).send(any(MimeMessage.class));
    }

    @Test
    void sendsOnlyToTheSingleOptedInParty() {
        when(templateEngine.process(anyString(), any())).thenReturn("<html>body</html>");
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage((jakarta.mail.Session) null));

        service.sendPhaseUpdate(event("alice@example.com", null));

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    @Test
    void rethrowsSmtpTransportFailureSoKafkaCanRetry() {
        when(templateEngine.process(anyString(), any())).thenReturn("<html>body</html>");
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage((jakarta.mail.Session) null));
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(MimeMessage.class));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> service.sendPhaseUpdate(event("alice@example.com", null)))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("SMTP transport failure");
    }

    @Test
    void skipsRenderingAndSendingWhenNobodyOptedIn() {
        service.sendPhaseUpdate(event(null, "   "));
        verify(mailSender, never()).createMimeMessage();
        verify(mailSender, never()).send(any(MimeMessage.class));
    }
}
