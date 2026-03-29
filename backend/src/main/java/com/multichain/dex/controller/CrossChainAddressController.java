package com.multichain.dex.controller;

import com.multichain.dex.domain.entity.CrossChainAddress;
import com.multichain.dex.repository.CrossChainAddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v2/addresses")
@RequiredArgsConstructor
public class CrossChainAddressController {

    private final CrossChainAddressRepository repo;

    /**
     * Register or update the EVM→SUI address mapping for a user.
     * Called by the frontend when creating EVM→SUI orders.
     */
    @PostMapping("/cross-chain")
    public ResponseEntity<Void> register(@RequestBody Map<String, String> body) {
        String evmAddress = body.get("evmAddress");
        String suiAddress = body.get("suiAddress");
        if (evmAddress == null || suiAddress == null) return ResponseEntity.badRequest().build();

        CrossChainAddress entry = repo.findById(evmAddress.toLowerCase())
                .orElseGet(() -> CrossChainAddress.builder().evmAddress(evmAddress.toLowerCase()).build());
        entry.setSuiAddress(suiAddress);
        repo.save(entry);
        return ResponseEntity.ok().build();
    }

    /**
     * Look up the full SUI address for a given EVM address.
     * Used by matchers when creating SUI HTLCs to set the correct participant.
     */
    @GetMapping("/cross-chain")
    public ResponseEntity<Map<String, String>> lookup(@RequestParam String evmAddress) {
        Optional<CrossChainAddress> entry = repo.findById(evmAddress.toLowerCase());
        return entry
                .map(a -> ResponseEntity.ok(Map.of("suiAddress", a.getSuiAddress())))
                .orElse(ResponseEntity.notFound().build());
    }
}
