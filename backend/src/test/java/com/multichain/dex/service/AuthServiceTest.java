package com.multichain.dex.service;

import com.multichain.dex.domain.entity.AuthNonce;
import com.multichain.dex.domain.entity.User;
import com.multichain.dex.dto.request.AuthVerifyRequest;
import com.multichain.dex.dto.response.AuthResponse;
import com.multichain.dex.dto.response.NonceResponse;
import com.multichain.dex.repository.AuthNonceRepository;
import com.multichain.dex.repository.UserRepository;
import com.multichain.dex.security.JwtTokenProvider;
import com.multichain.dex.security.SignatureVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthNonceRepository authNonceRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SignatureVerifier signatureVerifier;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private AuthService authService;

    private static final String WALLET_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
    private static final String NORMALIZED_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

    @Nested
    @DisplayName("generateNonce")
    class GenerateNonce {

        @Test
        @DisplayName("should generate nonce for new address")
        void shouldGenerateNonceForNewAddress() {
            // Given
            when(authNonceRepository.findByWalletAddressAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
            when(authNonceRepository.save(any(AuthNonce.class)))
                .thenAnswer(i -> i.getArgument(0));

            // When
            NonceResponse response = authService.generateNonce(WALLET_ADDRESS);

            // Then
            assertThat(response).isNotNull();
            assertThat(response.getNonce()).isNotBlank();
            assertThat(response.getMessage()).contains("Sign this message");
            assertThat(response.getMessage()).contains(response.getNonce());

            ArgumentCaptor<AuthNonce> nonceCaptor = ArgumentCaptor.forClass(AuthNonce.class);
            verify(authNonceRepository).save(nonceCaptor.capture());

            AuthNonce savedNonce = nonceCaptor.getValue();
            assertThat(savedNonce.getWalletAddress()).isEqualTo(NORMALIZED_ADDRESS);
            assertThat(savedNonce.isUsed()).isFalse();
            assertThat(savedNonce.getExpiresAt()).isAfter(LocalDateTime.now());
        }

        @Test
        @DisplayName("should delete existing unused nonce before generating new one")
        void shouldDeleteExistingUnusedNonce() {
            // Given
            AuthNonce existingNonce = AuthNonce.builder()
                .walletAddress(NORMALIZED_ADDRESS)
                .nonce("old-nonce")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .build();

            when(authNonceRepository.findByWalletAddressAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(existingNonce));
            when(authNonceRepository.save(any(AuthNonce.class)))
                .thenAnswer(i -> i.getArgument(0));

            // When
            authService.generateNonce(WALLET_ADDRESS);

            // Then
            verify(authNonceRepository).delete(existingNonce);
            verify(authNonceRepository).save(any(AuthNonce.class));
        }

        @Test
        @DisplayName("should normalize wallet address to lowercase")
        void shouldNormalizeAddressToLowercase() {
            // Given
            String mixedCaseAddress = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";

            when(authNonceRepository.findByWalletAddressAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
            when(authNonceRepository.save(any(AuthNonce.class)))
                .thenAnswer(i -> i.getArgument(0));

            // When
            authService.generateNonce(mixedCaseAddress);

            // Then
            ArgumentCaptor<AuthNonce> nonceCaptor = ArgumentCaptor.forClass(AuthNonce.class);
            verify(authNonceRepository).save(nonceCaptor.capture());
            assertThat(nonceCaptor.getValue().getWalletAddress())
                .isEqualTo(mixedCaseAddress.toLowerCase());
        }
    }

    @Nested
    @DisplayName("verifySignature")
    class VerifySignature {

        private AuthVerifyRequest validRequest;
        private AuthNonce validNonce;
        private User existingUser;

        @BeforeEach
        void setUp() {
            String nonce = UUID.randomUUID().toString();

            validRequest = new AuthVerifyRequest();
            validRequest.setWalletAddress(WALLET_ADDRESS);
            validRequest.setNonce(nonce);
            validRequest.setSignature("0xvalidsignature");

            validNonce = AuthNonce.builder()
                .walletAddress(NORMALIZED_ADDRESS)
                .nonce(nonce)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .used(false)
                .build();

            existingUser = User.builder()
                .id(UUID.randomUUID())
                .primaryWalletAddress(NORMALIZED_ADDRESS)
                .createdAt(LocalDateTime.now().minusDays(1))
                .build();
        }

        @Test
        @DisplayName("should verify signature and return token for existing user")
        void shouldVerifySignatureForExistingUser() {
            // Given
            when(authNonceRepository.findByNonceAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(validNonce));
            when(signatureVerifier.verifySignature(anyString(), anyString(), anyString()))
                .thenReturn(true);
            when(userRepository.findByPrimaryWalletAddress(NORMALIZED_ADDRESS))
                .thenReturn(Optional.of(existingUser));
            when(jwtTokenProvider.generateToken(any(UUID.class), anyString()))
                .thenReturn("jwt-token");
            when(authNonceRepository.save(any(AuthNonce.class)))
                .thenAnswer(i -> i.getArgument(0));
            when(userRepository.save(any(User.class)))
                .thenAnswer(i -> i.getArgument(0));

            // When
            AuthResponse response = authService.verifySignature(validRequest);

            // Then
            assertThat(response).isNotNull();
            assertThat(response.getToken()).isEqualTo("jwt-token");
            assertThat(response.getUserId()).isEqualTo(existingUser.getId());
            assertThat(response.getWalletAddress()).isEqualTo(NORMALIZED_ADDRESS);
            assertThat(response.isNewUser()).isFalse();

            verify(authNonceRepository).save(argThat(AuthNonce::isUsed));
        }

        @Test
        @DisplayName("should create new user if not exists")
        void shouldCreateNewUserIfNotExists() {
            // Given
            User newUser = User.builder()
                .id(UUID.randomUUID())
                .primaryWalletAddress(NORMALIZED_ADDRESS)
                .createdAt(LocalDateTime.now())
                .build();

            when(authNonceRepository.findByNonceAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(validNonce));
            when(signatureVerifier.verifySignature(anyString(), anyString(), anyString()))
                .thenReturn(true);
            when(userRepository.findByPrimaryWalletAddress(NORMALIZED_ADDRESS))
                .thenReturn(Optional.empty());
            when(userRepository.save(any(User.class)))
                .thenReturn(newUser);
            when(jwtTokenProvider.generateToken(any(UUID.class), anyString()))
                .thenReturn("jwt-token");
            when(authNonceRepository.save(any(AuthNonce.class)))
                .thenAnswer(i -> i.getArgument(0));

            // When
            AuthResponse response = authService.verifySignature(validRequest);

            // Then
            assertThat(response).isNotNull();
            assertThat(response.isNewUser()).isTrue();

            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository, times(2)).save(userCaptor.capture());
            assertThat(userCaptor.getAllValues().get(0).getPrimaryWalletAddress())
                .isEqualTo(NORMALIZED_ADDRESS);
        }

        @Test
        @DisplayName("should throw exception for invalid nonce")
        void shouldThrowExceptionForInvalidNonce() {
            // Given
            when(authNonceRepository.findByNonceAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> authService.verifySignature(validRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid or expired nonce");
        }

        @Test
        @DisplayName("should throw exception when nonce doesn't match wallet address")
        void shouldThrowExceptionWhenNonceDoesNotMatchAddress() {
            // Given
            validNonce.setWalletAddress("0xdifferentaddress");

            when(authNonceRepository.findByNonceAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(validNonce));

            // When/Then
            assertThatThrownBy(() -> authService.verifySignature(validRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Nonce does not match wallet address");
        }

        @Test
        @DisplayName("should throw exception for invalid signature")
        void shouldThrowExceptionForInvalidSignature() {
            // Given
            when(authNonceRepository.findByNonceAndUsedFalseAndExpiresAtAfter(
                anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(validNonce));
            when(signatureVerifier.verifySignature(anyString(), anyString(), anyString()))
                .thenReturn(false);

            // When/Then
            assertThatThrownBy(() -> authService.verifySignature(validRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid signature");
        }
    }

    @Nested
    @DisplayName("cleanupExpiredNonces")
    class CleanupExpiredNonces {

        @Test
        @DisplayName("should delete expired nonces")
        void shouldDeleteExpiredNonces() {
            // When
            authService.cleanupExpiredNonces();

            // Then
            verify(authNonceRepository).deleteExpiredOrUsedNonces(any(LocalDateTime.class));
        }
    }
}
