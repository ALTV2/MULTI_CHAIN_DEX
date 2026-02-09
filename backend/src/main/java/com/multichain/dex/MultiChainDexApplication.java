package com.multichain.dex;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MultiChainDexApplication {

    public static void main(String[] args) {
        SpringApplication.run(MultiChainDexApplication.class, args);
    }
}
