package com.multichain.dex.config;

import com.multichain.dex.repository.ChainRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Updates chain RPC URLs from environment variables on application startup.
 * Seed data contains placeholder URLs; this overwrites them with real Alchemy endpoints.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChainRpcInitializer {

    private final ChainRepository chainRepo;

    @Value("${SEPOLIA_RPC_URL:}")
    private String sepoliaRpcUrl;

    @Value("${POLYGON_RPC_URL:}")
    private String polygonRpcUrl;

    @Value("${SUI_RPC_URL:}")
    private String suiRpcUrl;

    @PostConstruct
    void updateRpcUrls() {
        updateIfPresent("11155111", sepoliaRpcUrl);
        updateIfPresent("80002", polygonRpcUrl);
        updateIfPresent("sui:testnet", suiRpcUrl);
    }

    private void updateIfPresent(String chainId, String rpcUrl) {
        if (rpcUrl == null || rpcUrl.isBlank()) return;

        chainRepo.findById(chainId).ifPresent(chain -> {
            if (!rpcUrl.equals(chain.getRpcUrl())) {
                chain.setRpcUrl(rpcUrl);
                chainRepo.save(chain);
                log.info("Updated RPC URL for chain {}", chainId);
            }
        });
    }
}
