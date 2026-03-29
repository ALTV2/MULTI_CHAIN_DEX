package com.multichain.dex;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Multi-Chain DEX Backend — blockchain indexer and REST API.
 *
 * <p>Periodically polls EVM and SUI blockchains for order and HTLC data,
 * stores it in PostgreSQL, and exposes a clean REST API for the frontend.
 * No authentication — all data is public blockchain data.</p>
 */
@SpringBootApplication
@EnableScheduling
@EnableAsync
public class MultiChainDexApplication {

    public static void main(String[] args) {
        SpringApplication.run(MultiChainDexApplication.class, args);
    }
}
