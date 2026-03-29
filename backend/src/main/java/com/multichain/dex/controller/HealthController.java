package com.multichain.dex.controller;

import com.multichain.dex.repository.ChainRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2")
@RequiredArgsConstructor
public class HealthController {

    private final ChainRepository chainRepo;

    @GetMapping("/health")
    public Map<String, Object> health() {
        var chains = chainRepo.findAll().stream()
                .map(c -> Map.of(
                        "id", c.getId(),
                        "name", c.getShortName(),
                        "lastPolledAt", c.getLastPolledAt() != null ? c.getLastPolledAt().toString() : "never",
                        "lastIndexedBlock", c.getLastIndexedBlock()
                ))
                .toList();

        return Map.of(
                "status", "UP",
                "timestamp", Instant.now().toString(),
                "chains", chains
        );
    }
}
