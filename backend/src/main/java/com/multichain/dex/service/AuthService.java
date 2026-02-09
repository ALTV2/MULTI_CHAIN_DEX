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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AuthNonceRepository authNonceRepository;
    private final UserRepository userRepository;
    private final SignatureVerifier signatureVerifier;
    private final JwtTokenProvider jwtTokenProvider;

    private static final int NONCE_EXPIRY_MINUTES = 10;

    @Transactional
    public NonceResponse generateNonce(String walletAddress) {
        String normalizedAddress = walletAddress.toLowerCase();

        // Delete any existing unused nonces for this address
        authNonceRepository.findByWalletAddressAndUsedFalseAndExpiresAtAfter(
            normalizedAddress, LocalDateTime.now()
        ).ifPresent(authNonceRepository::delete);

        // Generate new nonce
        String nonce = UUID.randomUUID().toString();

        AuthNonce authNonce = AuthNonce.builder()
            .walletAddress(normalizedAddress)
            .nonce(nonce)
            .expiresAt(LocalDateTime.now().plusMinutes(NONCE_EXPIRY_MINUTES))
            .build();

        authNonceRepository.save(authNonce);

        String message = buildSignMessage(nonce);
        return new NonceResponse(message, nonce);
    }

    @Transactional
    public AuthResponse verifySignature(AuthVerifyRequest request) {
        String normalizedAddress = request.getWalletAddress().toLowerCase();

        // Find valid nonce
        AuthNonce authNonce = authNonceRepository
            .findByNonceAndUsedFalseAndExpiresAtAfter(request.getNonce(), LocalDateTime.now())
            .orElseThrow(() -> new IllegalArgumentException("Invalid or expired nonce"));

        if (!authNonce.getWalletAddress().equals(normalizedAddress)) {
            throw new IllegalArgumentException("Nonce does not match wallet address");
        }

        // Verify signature
        String message = buildSignMessage(request.getNonce());
        boolean isValid = signatureVerifier.verifySignature(message, request.getSignature(), normalizedAddress);

        if (!isValid) {
            throw new IllegalArgumentException("Invalid signature");
        }

        // Mark nonce as used
        authNonce.setUsed(true);
        authNonceRepository.save(authNonce);

        // Find or create user
        User user = userRepository.findByPrimaryWalletAddress(normalizedAddress)
            .orElseGet(() -> createNewUser(normalizedAddress));

        // Update last login
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        // Generate JWT
        String token = jwtTokenProvider.generateToken(user.getId(), normalizedAddress);

        return AuthResponse.builder()
            .token(token)
            .userId(user.getId())
            .walletAddress(normalizedAddress)
            .isNewUser(user.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(5)))
            .build();
    }

    private User createNewUser(String walletAddress) {
        User user = User.builder()
            .primaryWalletAddress(walletAddress)
            .build();
        return userRepository.save(user);
    }

    private String buildSignMessage(String nonce) {
        return "Sign this message to authenticate with MultiChain DEX.\n\nNonce: " + nonce;
    }

    @Scheduled(fixedRate = 300000) // Every 5 minutes
    @Transactional
    public void cleanupExpiredNonces() {
        authNonceRepository.deleteExpiredOrUsedNonces(LocalDateTime.now());
        log.debug("Cleaned up expired nonces");
    }
}
