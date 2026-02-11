package com.multichain.dex.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateHtlcIdRequest {
    @NotBlank(message = "HTLC swap ID is required")
    private String htlcSwapId;

    public String getHtlcSwapId() { return htlcSwapId; }
    public void setHtlcSwapId(String htlcSwapId) { this.htlcSwapId = htlcSwapId; }
}
