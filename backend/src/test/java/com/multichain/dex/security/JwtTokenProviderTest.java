package com.multichain.dex.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;

    private static final String SECRET = "test-secret-key-for-jwt-token-generation-must-be-at-least-256-bits-long";
    private static final long EXPIRATION = 3600000; // 1 hour

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(jwtTokenProvider, "jwtSecret", SECRET);
        ReflectionTestUtils.setField(jwtTokenProvider, "jwtExpiration", EXPIRATION);
        jwtTokenProvider.init();
    }

    @Nested
    @DisplayName("generateToken")
    class GenerateToken {

        @Test
        @DisplayName("should generate valid JWT token")
        void shouldGenerateValidToken() {
            // Given
            UUID userId = UUID.randomUUID();
            String walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

            // When
            String token = jwtTokenProvider.generateToken(userId, walletAddress);

            // Then
            assertThat(token).isNotBlank();
            assertThat(token.split("\\.")).hasSize(3); // JWT has 3 parts
        }

        @Test
        @DisplayName("should generate different tokens for different users")
        void shouldGenerateDifferentTokensForDifferentUsers() {
            // Given
            UUID userId1 = UUID.randomUUID();
            UUID userId2 = UUID.randomUUID();
            String walletAddress1 = "0x1111111111111111111111111111111111111111";
            String walletAddress2 = "0x2222222222222222222222222222222222222222";

            // When
            String token1 = jwtTokenProvider.generateToken(userId1, walletAddress1);
            String token2 = jwtTokenProvider.generateToken(userId2, walletAddress2);

            // Then
            assertThat(token1).isNotEqualTo(token2);
        }
    }

    @Nested
    @DisplayName("validateToken")
    class ValidateToken {

        @Test
        @DisplayName("should validate correct token")
        void shouldValidateCorrectToken() {
            // Given
            UUID userId = UUID.randomUUID();
            String walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
            String token = jwtTokenProvider.generateToken(userId, walletAddress);

            // When
            boolean isValid = jwtTokenProvider.validateToken(token);

            // Then
            assertThat(isValid).isTrue();
        }

        @Test
        @DisplayName("should reject invalid token")
        void shouldRejectInvalidToken() {
            // Given
            String invalidToken = "invalid.jwt.token";

            // When
            boolean isValid = jwtTokenProvider.validateToken(invalidToken);

            // Then
            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("should reject null token")
        void shouldRejectNullToken() {
            // When
            boolean isValid = jwtTokenProvider.validateToken(null);

            // Then
            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("should reject empty token")
        void shouldRejectEmptyToken() {
            // When
            boolean isValid = jwtTokenProvider.validateToken("");

            // Then
            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("should reject token with wrong signature")
        void shouldRejectTokenWithWrongSignature() {
            // Given
            UUID userId = UUID.randomUUID();
            String walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
            String token = jwtTokenProvider.generateToken(userId, walletAddress);

            // Tamper with the token
            String tamperedToken = token.substring(0, token.length() - 5) + "xxxxx";

            // When
            boolean isValid = jwtTokenProvider.validateToken(tamperedToken);

            // Then
            assertThat(isValid).isFalse();
        }
    }

    @Nested
    @DisplayName("getUserIdFromToken")
    class GetUserIdFromToken {

        @Test
        @DisplayName("should extract correct user ID from token")
        void shouldExtractCorrectUserId() {
            // Given
            UUID userId = UUID.randomUUID();
            String walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
            String token = jwtTokenProvider.generateToken(userId, walletAddress);

            // When
            UUID extractedUserId = jwtTokenProvider.getUserIdFromToken(token);

            // Then
            assertThat(extractedUserId).isEqualTo(userId);
        }
    }

    @Nested
    @DisplayName("getWalletFromToken")
    class GetWalletFromToken {

        @Test
        @DisplayName("should extract correct wallet address from token")
        void shouldExtractCorrectWalletAddress() {
            // Given
            UUID userId = UUID.randomUUID();
            String walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
            String token = jwtTokenProvider.generateToken(userId, walletAddress);

            // When
            String extractedAddress = jwtTokenProvider.getWalletFromToken(token);

            // Then
            assertThat(extractedAddress).isEqualTo(walletAddress);
        }
    }
}
