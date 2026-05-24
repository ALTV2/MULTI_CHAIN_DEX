package com.multichain.dex.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multichain.dex.dto.TxNotifyRequest;
import com.multichain.dex.service.TxNotifyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TxNotifyControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private TxNotifyService txNotifyService;

    @Test
    void notify_validRequest_returns202() throws Exception {
        var request = new TxNotifyRequest("11155111", "0xabc123", "HTLC_CREATE", "5", "0xwallet");

        mockMvc.perform(post("/api/v2/tx/notify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted());

        verify(txNotifyService).processAsync(any(TxNotifyRequest.class));
    }

    @Test
    void notify_missingChainId_returns400() throws Exception {
        var request = new TxNotifyRequest("", "0xabc123", "HTLC_CREATE", null, null);

        mockMvc.perform(post("/api/v2/tx/notify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void notify_missingTxHash_returns400() throws Exception {
        var request = new TxNotifyRequest("11155111", "", "HTLC_CREATE", null, null);

        mockMvc.perform(post("/api/v2/tx/notify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void notify_optionalFieldsNull_returns202() throws Exception {
        var request = new TxNotifyRequest("11155111", "0xabc", "ORDER_CREATE", null, null);

        mockMvc.perform(post("/api/v2/tx/notify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted());
    }
}
