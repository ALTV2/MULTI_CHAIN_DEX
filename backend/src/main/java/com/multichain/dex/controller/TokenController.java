package com.multichain.dex.controller;

import com.multichain.dex.dto.TokenResponse;
import com.multichain.dex.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/tokens")
@RequiredArgsConstructor
public class TokenController {

    private final TokenRepository tokenRepo;

    @GetMapping
    public List<TokenResponse> getTokens(@RequestParam(required = false) String chainId) {
        var tokens = chainId != null
                ? tokenRepo.findByChainId(chainId)
                : tokenRepo.findAll();
        return tokens.stream()
                .map(TokenResponse::from)
                .toList();
    }
}
