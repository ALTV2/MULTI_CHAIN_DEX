package com.multichain.dex.service;

import com.multichain.dex.domain.entity.User;
import com.multichain.dex.domain.entity.Wallet;
import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.dto.request.AddWalletRequest;
import com.multichain.dex.dto.response.WalletResponse;
import com.multichain.dex.repository.UserRepository;
import com.multichain.dex.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;

    @Value("${encryption.key}")
    private String encryptionKey;

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    @Transactional(readOnly = true)
    public List<WalletResponse> getUserWallets(UUID userId) {
        return walletRepository.findByUserId(userId).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<WalletResponse> getUserWalletsByChain(UUID userId, ChainType chain) {
        return walletRepository.findByUserIdAndChain(userId, chain).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public WalletResponse addWallet(UUID userId, AddWalletRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String normalizedAddress = request.getAddress().toLowerCase();

        // Check if wallet already exists
        if (walletRepository.existsByUserIdAndAddressAndChain(userId, normalizedAddress, request.getChain())) {
            throw new IllegalArgumentException("Wallet already exists for this chain");
        }

        Wallet wallet = Wallet.builder()
            .user(user)
            .address(normalizedAddress)
            .chain(request.getChain())
            .label(request.getLabel())
            .imported(request.getPrivateKey() != null)
            .build();

        // Encrypt private key if provided
        if (request.getPrivateKey() != null) {
            try {
                String encrypted = encrypt(request.getPrivateKey());
                wallet.setEncryptedPrivateKey(encrypted);
            } catch (Exception e) {
                log.error("Failed to encrypt private key", e);
                throw new RuntimeException("Failed to secure wallet");
            }
        }

        // Set as primary if it's the first wallet
        if (walletRepository.findByUserId(userId).isEmpty()) {
            wallet.setPrimary(true);
        }

        wallet = walletRepository.save(wallet);
        return toResponse(wallet);
    }

    @Transactional
    public void removeWallet(UUID userId, UUID walletId) {
        Wallet wallet = walletRepository.findById(walletId)
            .orElseThrow(() -> new IllegalArgumentException("Wallet not found"));

        if (!wallet.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Wallet does not belong to user");
        }

        if (wallet.isPrimary()) {
            throw new IllegalArgumentException("Cannot remove primary wallet");
        }

        walletRepository.delete(wallet);
    }

    @Transactional
    public WalletResponse updateWalletLabel(UUID userId, UUID walletId, String label) {
        Wallet wallet = walletRepository.findById(walletId)
            .orElseThrow(() -> new IllegalArgumentException("Wallet not found"));

        if (!wallet.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Wallet does not belong to user");
        }

        wallet.setLabel(label);
        wallet = walletRepository.save(wallet);
        return toResponse(wallet);
    }

    @Transactional
    public void setPrimaryWallet(UUID userId, UUID walletId) {
        Wallet newPrimary = walletRepository.findById(walletId)
            .orElseThrow(() -> new IllegalArgumentException("Wallet not found"));

        if (!newPrimary.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Wallet does not belong to user");
        }

        // Remove primary from current
        walletRepository.findByUserIdAndIsPrimaryTrue(userId)
            .ifPresent(current -> {
                current.setPrimary(false);
                walletRepository.save(current);
            });

        // Set new primary
        newPrimary.setPrimary(true);
        walletRepository.save(newPrimary);
    }

    private String encrypt(String plainText) throws Exception {
        SecretKeySpec keySpec = new SecretKeySpec(
            encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");

        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);
        GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, parameterSpec);

        byte[] encryptedData = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

        // Combine IV + encrypted data
        byte[] combined = new byte[iv.length + encryptedData.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(encryptedData, 0, combined, iv.length, encryptedData.length);

        return Base64.getEncoder().encodeToString(combined);
    }

    private WalletResponse toResponse(Wallet wallet) {
        return WalletResponse.builder()
            .id(wallet.getId())
            .address(wallet.getAddress())
            .chain(wallet.getChain())
            .label(wallet.getLabel())
            .imported(wallet.isImported())
            .isPrimary(wallet.isPrimary())
            .hasPrivateKey(wallet.getEncryptedPrivateKey() != null)
            .createdAt(wallet.getCreatedAt())
            .build();
    }
}
