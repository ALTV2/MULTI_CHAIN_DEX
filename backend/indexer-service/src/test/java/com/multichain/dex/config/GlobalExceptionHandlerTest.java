package com.multichain.dex.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void illegalArgumentMapsTo400WithMessage() {
        ResponseEntity<Map<String, Object>> res = handler.handleBadRequest(new IllegalArgumentException("bad input"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody()).containsEntry("error", "bad input");
        assertThat(res.getBody()).containsKey("timestamp");
    }

    @Test
    void missingParameterMapsTo400() {
        var ex = new MissingServletRequestParameterException("wallet", "String");
        ResponseEntity<Map<String, Object>> res = handler.handleMissingParam(ex);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((String) res.getBody().get("error")).contains("wallet");
    }

    @Test
    void validationErrorsAreAggregatedInto400() {
        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        BindingResult br = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(br);
        when(br.getFieldErrors()).thenReturn(List.of(new FieldError("req", "email", "must be a valid email")));

        ResponseEntity<Map<String, Object>> res = handler.handleValidation(ex);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((String) res.getBody().get("error")).contains("email", "must be a valid email");
    }

    @Test
    void unhandledExceptionMapsTo500WithoutLeakingDetails() {
        ResponseEntity<Map<String, Object>> res = handler.handleGeneral(new RuntimeException("stacktrace secret"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(res.getBody()).containsEntry("error", "Internal server error");
    }
}
