package com.multichain.dex.controller;

import com.multichain.dex.dto.SwapResponse;
import com.multichain.dex.service.SwapQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SwapControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private SwapQueryService swapQueryService;

    @Test
    void getActiveSwaps_returnsOk() throws Exception {
        when(swapQueryService.findActiveSwaps(any())).thenReturn(List.of());
        mockMvc.perform(get("/api/v2/swaps/active").param("wallet", "0xabc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getActiveSwaps_multipleWallets() throws Exception {
        when(swapQueryService.findActiveSwaps(any())).thenReturn(List.of());
        mockMvc.perform(get("/api/v2/swaps/active")
                        .param("wallet", "0xabc")
                        .param("wallet", "0xdef"))
                .andExpect(status().isOk());
    }

    @Test
    void getActiveSwaps_missingWallet_returns400() throws Exception {
        mockMvc.perform(get("/api/v2/swaps/active"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getHistory_returnsPagedResult() throws Exception {
        when(swapQueryService.findHistory(any(), any())).thenReturn(new PageImpl<>(List.of()));
        mockMvc.perform(get("/api/v2/swaps/history")
                        .param("wallet", "0xabc")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void getHistory_missingWallet_returns400() throws Exception {
        mockMvc.perform(get("/api/v2/swaps/history"))
                .andExpect(status().isBadRequest());
    }
}
