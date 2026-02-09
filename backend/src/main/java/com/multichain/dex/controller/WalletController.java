package com.multichain.dex.controller;

import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.dto.request.AddWalletRequest;
import com.multichain.dex.dto.response.WalletResponse;
import com.multichain.dex.security.UserPrincipal;
import com.multichain.dex.service.WalletService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Tag(name = "Wallet", description = "Wallet management endpoints")
@SecurityRequirement(name = "bearer-jwt")
public class WalletController {

    private final WalletService walletService;

    @GetMapping
    @Operation(summary = "Get all wallets", description = "Get all wallets for the authenticated user")
    public ResponseEntity<List<WalletResponse>> getWallets(@AuthenticationPrincipal UserPrincipal principal) {
        List<WalletResponse> wallets = walletService.getUserWallets(principal.getUserId());
        return ResponseEntity.ok(wallets);
    }

    @GetMapping("/chain/{chain}")
    @Operation(summary = "Get wallets by chain", description = "Get wallets for a specific chain")
    public ResponseEntity<List<WalletResponse>> getWalletsByChain(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable ChainType chain) {
        List<WalletResponse> wallets = walletService.getUserWalletsByChain(principal.getUserId(), chain);
        return ResponseEntity.ok(wallets);
    }

    @PostMapping
    @Operation(summary = "Add wallet", description = "Add a new wallet to the user account")
    public ResponseEntity<WalletResponse> addWallet(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AddWalletRequest request) {
        WalletResponse wallet = walletService.addWallet(principal.getUserId(), request);
        return ResponseEntity.ok(wallet);
    }

    @DeleteMapping("/{walletId}")
    @Operation(summary = "Remove wallet", description = "Remove a wallet from the user account")
    public ResponseEntity<Void> removeWallet(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId) {
        walletService.removeWallet(principal.getUserId(), walletId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{walletId}/label")
    @Operation(summary = "Update wallet label", description = "Update the label of a wallet")
    public ResponseEntity<WalletResponse> updateLabel(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @RequestBody Map<String, String> body) {
        String label = body.get("label");
        WalletResponse wallet = walletService.updateWalletLabel(principal.getUserId(), walletId, label);
        return ResponseEntity.ok(wallet);
    }

    @PostMapping("/{walletId}/primary")
    @Operation(summary = "Set primary wallet", description = "Set a wallet as the primary wallet")
    public ResponseEntity<Void> setPrimary(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId) {
        walletService.setPrimaryWallet(principal.getUserId(), walletId);
        return ResponseEntity.ok().build();
    }
}
