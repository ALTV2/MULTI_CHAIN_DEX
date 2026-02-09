package com.multichain.dex.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multichain.dex.dto.request.NonceRequest;
import com.multichain.dex.dto.response.NonceResponse;
import com.multichain.dex.repository.AuthNonceRepository;
import com.multichain.dex.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuthNonceRepository authNonceRepository;

    @Autowired
    private UserRepository userRepository;

    private static final String WALLET_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

    @BeforeEach
    void setUp() {
        authNonceRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("POST /api/auth/nonce - should generate nonce for wallet address")
    void shouldGenerateNonceForWalletAddress() throws Exception {
        // Given
        NonceRequest request = new NonceRequest();
        request.setWalletAddress(WALLET_ADDRESS);

        // When/Then
        MvcResult result = mockMvc.perform(post("/api/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nonce").isNotEmpty())
            .andExpect(jsonPath("$.message").isNotEmpty())
            .andReturn();

        // Verify nonce is saved in database
        String responseBody = result.getResponse().getContentAsString();
        NonceResponse response = objectMapper.readValue(responseBody, NonceResponse.class);

        assertThat(authNonceRepository.findByNonceAndUsedFalseAndExpiresAtAfter(
            response.getNonce(), java.time.LocalDateTime.now()))
            .isPresent();
    }

    @Test
    @DisplayName("POST /api/auth/nonce - should normalize wallet address to lowercase")
    void shouldNormalizeWalletAddressToLowercase() throws Exception {
        // Given
        NonceRequest request = new NonceRequest();
        request.setWalletAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");

        // When
        mockMvc.perform(post("/api/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk());

        // Then
        assertThat(authNonceRepository.findAll().get(0).getWalletAddress())
            .isEqualTo("0xabcdef1234567890abcdef1234567890abcdef12");
    }

    @Test
    @DisplayName("POST /api/auth/nonce - should replace existing nonce for same address")
    void shouldReplaceExistingNonceForSameAddress() throws Exception {
        // Given
        NonceRequest request = new NonceRequest();
        request.setWalletAddress(WALLET_ADDRESS);

        // Create first nonce
        mockMvc.perform(post("/api/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk());

        long countAfterFirst = authNonceRepository.count();

        // Create second nonce
        mockMvc.perform(post("/api/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk());

        // Then - should still have only one active nonce
        long countAfterSecond = authNonceRepository.count();
        assertThat(countAfterSecond).isEqualTo(countAfterFirst);
    }

    @Test
    @DisplayName("POST /api/auth/nonce - should reject invalid wallet address")
    void shouldRejectInvalidWalletAddress() throws Exception {
        // Given
        NonceRequest request = new NonceRequest();
        request.setWalletAddress("invalid-address");

        // When/Then
        mockMvc.perform(post("/api/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/auth/nonce - should reject empty wallet address")
    void shouldRejectEmptyWalletAddress() throws Exception {
        // Given
        NonceRequest request = new NonceRequest();
        request.setWalletAddress("");

        // When/Then
        mockMvc.perform(post("/api/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }
}
