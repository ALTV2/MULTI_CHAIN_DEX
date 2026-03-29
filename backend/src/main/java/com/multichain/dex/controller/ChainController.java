package com.multichain.dex.controller;

import com.multichain.dex.dto.ChainResponse;
import com.multichain.dex.repository.ChainRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v2/chains")
@RequiredArgsConstructor
public class ChainController {

    private final ChainRepository chainRepo;

    @GetMapping
    public List<ChainResponse> getChains() {
        return chainRepo.findAll().stream()
                .map(ChainResponse::from)
                .toList();
    }
}
