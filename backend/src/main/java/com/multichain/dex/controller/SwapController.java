package com.multichain.dex.controller;

import com.multichain.dex.domain.enums.SwapStatus;
import com.multichain.dex.dto.request.CreateSwapRequest;
import com.multichain.dex.dto.response.SwapHistoryResponse;
import com.multichain.dex.security.UserPrincipal;
import com.multichain.dex.service.SwapService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/swap")
@RequiredArgsConstructor
@Tag(name = "Swap", description = "Cross-chain swap management endpoints")
@SecurityRequirement(name = "bearer-jwt")
public class SwapController {

    private final SwapService swapService;

    @PostMapping
    @Operation(summary = "Create swap record", description = "Create a new swap record for tracking")
    public ResponseEntity<SwapHistoryResponse> createSwap(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateSwapRequest request) {
        SwapHistoryResponse response = swapService.createSwapRecord(principal.getUserId(), request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    @Operation(summary = "Get swap history", description = "Get paginated swap history for the user")
    public ResponseEntity<Page<SwapHistoryResponse>> getSwapHistory(
            @AuthenticationPrincipal UserPrincipal principal,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<SwapHistoryResponse> history = swapService.getUserSwapHistory(principal.getUserId(), pageable);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/active")
    @Operation(summary = "Get active swaps", description = "Get all active swaps for the user")
    public ResponseEntity<List<SwapHistoryResponse>> getActiveSwaps(
            @AuthenticationPrincipal UserPrincipal principal) {
        List<SwapHistoryResponse> swaps = swapService.getActiveSwaps(principal.getUserId());
        return ResponseEntity.ok(swaps);
    }

    @GetMapping("/{swapId}")
    @Operation(summary = "Get swap by ID", description = "Get swap details by ID")
    public ResponseEntity<SwapHistoryResponse> getSwapById(@PathVariable UUID swapId) {
        SwapHistoryResponse response = swapService.getSwapById(swapId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/htlc/{htlcSwapId}")
    @Operation(summary = "Get swap by HTLC ID", description = "Get swap details by HTLC swap ID")
    public ResponseEntity<SwapHistoryResponse> getSwapByHtlcId(@PathVariable String htlcSwapId) {
        SwapHistoryResponse response = swapService.getSwapByHtlcId(htlcSwapId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{swapId}/status")
    @Operation(summary = "Update swap status", description = "Update the status of a swap")
    public ResponseEntity<SwapHistoryResponse> updateStatus(
            @PathVariable UUID swapId,
            @RequestBody Map<String, Object> body) {
        SwapStatus status = SwapStatus.valueOf((String) body.get("status"));
        String txHash = (String) body.get("txHash");
        Boolean isSourceTx = (Boolean) body.getOrDefault("isSourceTx", true);

        SwapHistoryResponse response = swapService.updateSwapStatus(swapId, status, txHash, isSourceTx);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{swapId}/htlc")
    @Operation(summary = "Update HTLC swap ID", description = "Set the on-chain HTLC swap ID")
    public ResponseEntity<SwapHistoryResponse> updateHtlcId(
            @PathVariable UUID swapId,
            @RequestBody Map<String, String> body) {
        String htlcSwapId = body.get("htlcSwapId");
        SwapHistoryResponse response = swapService.updateHtlcSwapId(swapId, htlcSwapId);
        return ResponseEntity.ok(response);
    }
}
