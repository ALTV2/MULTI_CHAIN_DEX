package com.multichain.dex.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateSwapStatusRequest {
    @NotBlank(message = "Status is required")
    private String status;

    private String txHash;

    private Boolean isSourceTx;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTxHash() { return txHash; }
    public void setTxHash(String txHash) { this.txHash = txHash; }

    public Boolean getIsSourceTx() { return isSourceTx; }
    public void setIsSourceTx(Boolean isSourceTx) { this.isSourceTx = isSourceTx; }
}
