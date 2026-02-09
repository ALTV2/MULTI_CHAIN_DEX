package com.multichain.dex.dto.request;

import com.multichain.dex.domain.enums.ChainType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AddWalletRequest {
    @NotBlank(message = "Address is required")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Invalid wallet address format")
    private String address;

    @NotNull(message = "Chain is required")
    private ChainType chain;

    @Size(max = 50, message = "Label must be at most 50 characters")
    private String label;

    // Optional - only if user wants to import private key
    private String privateKey;
}
