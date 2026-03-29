package com.multichain.dex.controller;

import com.multichain.dex.dto.SwapResponse;
import com.multichain.dex.service.SwapQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/swaps")
@RequiredArgsConstructor
public class SwapController {

    private final SwapQueryService swapQueryService;

    /**
     * Active swaps: non-terminal orders where any of the provided wallets is involved.
     * Enriched with HTLC details and computed phase.
     */
    @GetMapping("/active")
    public List<SwapResponse> getActiveSwaps(@RequestParam List<String> wallet) {
        return swapQueryService.findActiveSwaps(wallet);
    }

    /**
     * Swap history: completed/cancelled/expired orders for the provided wallets.
     */
    @GetMapping("/history")
    public Page<SwapResponse> getHistory(
            @RequestParam List<String> wallet,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        var pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "completedAt"));
        return swapQueryService.findHistory(wallet, pageable);
    }
}
