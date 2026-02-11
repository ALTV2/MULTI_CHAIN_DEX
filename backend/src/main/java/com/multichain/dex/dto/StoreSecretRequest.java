package com.multichain.dex.dto;

import jakarta.validation.constraints.NotBlank;

public class StoreSecretRequest {
    @NotBlank(message = "Encrypted secret is required")
    private String encryptedSecret;

    public String getEncryptedSecret() { return encryptedSecret; }
    public void setEncryptedSecret(String encryptedSecret) { this.encryptedSecret = encryptedSecret; }
}
