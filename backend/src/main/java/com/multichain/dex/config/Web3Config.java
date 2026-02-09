package com.multichain.dex.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

@Configuration
@Getter
public class Web3Config {

    @Value("${blockchain.ethereum.rpc-url}")
    private String ethereumRpcUrl;

    @Value("${blockchain.ethereum.chain-id}")
    private long ethereumChainId;

    @Value("${blockchain.ethereum.htlc-address}")
    private String ethereumHtlcAddress;

    @Value("${blockchain.ethereum.cross-chain-order-book-address}")
    private String ethereumCcobAddress;

    @Value("${blockchain.polygon.rpc-url}")
    private String polygonRpcUrl;

    @Value("${blockchain.polygon.chain-id}")
    private long polygonChainId;

    @Value("${blockchain.polygon.htlc-address}")
    private String polygonHtlcAddress;

    @Value("${blockchain.polygon.cross-chain-order-book-address}")
    private String polygonCcobAddress;

    @Bean(name = "ethereumWeb3j")
    public Web3j ethereumWeb3j() {
        return Web3j.build(new HttpService(ethereumRpcUrl));
    }

    @Bean(name = "polygonWeb3j")
    public Web3j polygonWeb3j() {
        return Web3j.build(new HttpService(polygonRpcUrl));
    }
}
