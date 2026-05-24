package com.multichain.dex.notification;

import com.multichain.dex.notification.event.OrderPhaseEvent;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.support.Acknowledgment;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OrderEventListenerTest {

    private OrderPhaseEvent sampleEvent() {
        return new OrderPhaseEvent(
                "uuid-1", "11155111", "5", "CROSS_CHAIN", "SECRET_REVEALED",
                "alice@example.com", null, "0xCreator", "0xMatcher",
                "TKA", "100", "MATIC", "5", "Ethereum (Sepolia)", "Polygon (Amoy)"
        );
    }

    @Test
    void delegatesEachEventToTheEmailServiceAndAcksOnSuccess() {
        EmailService emailService = mock(EmailService.class);
        Acknowledgment ack = mock(Acknowledgment.class);
        OrderEventListener listener = new OrderEventListener(emailService);

        OrderPhaseEvent event = sampleEvent();

        listener.onOrderPhase(event, ack);

        verify(emailService).sendPhaseUpdate(event);
        verify(ack).acknowledge();
    }

    @Test
    void doesNotAckIfEmailServiceThrows() {
        EmailService emailService = mock(EmailService.class);
        Acknowledgment ack = mock(Acknowledgment.class);
        OrderEventListener listener = new OrderEventListener(emailService);

        OrderPhaseEvent event = sampleEvent();
        doThrow(new RuntimeException("SMTP down")).when(emailService).sendPhaseUpdate(event);

        assertThrows(RuntimeException.class, () -> listener.onOrderPhase(event, ack));
        verify(ack, never()).acknowledge();
    }
}
