package com.multichain.dex.controller;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.TokenRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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
class ReferenceDataControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private ChainRepository chainRepo;
    @MockBean private TokenRepository tokenRepo;

    @Test
    void getChains_returnsAll() throws Exception {
        Chain sepolia = TestDataBuilder.sepolia();
        Chain sui = TestDataBuilder.sui();
        when(chainRepo.findAll()).thenReturn(List.of(sepolia, sui));

        mockMvc.perform(get("/api/v2/chains"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("11155111"))
                .andExpect(jsonPath("$[0].chainType").value("EVM"))
                .andExpect(jsonPath("$[0].nativeSymbol").value("ETH"))
                .andExpect(jsonPath("$[1].id").value("sui:testnet"))
                .andExpect(jsonPath("$[1].chainType").value("SUI"));
    }

    @Test
    void getChains_includesContracts() throws Exception {
        when(chainRepo.findAll()).thenReturn(List.of(TestDataBuilder.sepolia()));

        mockMvc.perform(get("/api/v2/chains"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].contracts.htlc").value("0xHTLC"))
                .andExpect(jsonPath("$[0].contracts.orderBook").value("0xOB"));
    }

    @Test
    void getTokens_allChains() throws Exception {
        Chain sepolia = TestDataBuilder.sepolia();
        Token eth = TestDataBuilder.eth(sepolia);
        Token tka = TestDataBuilder.tka(sepolia);
        when(tokenRepo.findAll()).thenReturn(List.of(eth, tka));

        mockMvc.perform(get("/api/v2/tokens"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].symbol").value("ETH"))
                .andExpect(jsonPath("$[0].isNative").value(true))
                .andExpect(jsonPath("$[1].symbol").value("TKA"))
                .andExpect(jsonPath("$[1].decimals").value(18));
    }

    @Test
    void getTokens_filteredByChain() throws Exception {
        Chain sepolia = TestDataBuilder.sepolia();
        Token tka = TestDataBuilder.tka(sepolia);
        when(tokenRepo.findByChainId("11155111")).thenReturn(List.of(tka));

        mockMvc.perform(get("/api/v2/tokens").param("chainId", "11155111"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].chainId").value("11155111"));
    }

    @Test
    void getTokens_unknownChain_returnsEmpty() throws Exception {
        when(tokenRepo.findByChainId("99999")).thenReturn(List.of());

        mockMvc.perform(get("/api/v2/tokens").param("chainId", "99999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void healthEndpoint_returnsUp() throws Exception {
        when(chainRepo.findAll()).thenReturn(List.of(TestDataBuilder.sepolia()));

        mockMvc.perform(get("/api/v2/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.chains").isArray());
    }
}
