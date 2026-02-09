package com.multichain.dex.controller;

import com.multichain.dex.dto.request.AuthVerifyRequest;
import com.multichain.dex.dto.request.NonceRequest;
import com.multichain.dex.dto.response.AuthResponse;
import com.multichain.dex.dto.response.NonceResponse;
import com.multichain.dex.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Web3 authentication endpoints")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/nonce")
    @Operation(summary = "Get nonce for signing", description = "Generate a nonce for the wallet to sign")
    public ResponseEntity<NonceResponse> getNonce(@Valid @RequestBody NonceRequest request) {
        NonceResponse response = authService.generateNonce(request.getWalletAddress());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify")
    @Operation(summary = "Verify signature", description = "Verify wallet signature and get JWT token")
    public ResponseEntity<AuthResponse> verifySignature(@Valid @RequestBody AuthVerifyRequest request) {
        AuthResponse response = authService.verifySignature(request);
        return ResponseEntity.ok(response);
    }
}
