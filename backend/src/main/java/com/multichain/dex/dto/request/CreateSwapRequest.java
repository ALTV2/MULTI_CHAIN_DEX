package com.multichain.dex.dto.request;

import com.multichain.dex.domain.enums.ChainType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreateSwapRequest {
    @NotNull(message = "Source chain is required")
    private ChainType sourceChain;

    @NotNull(message = "Target chain is required")
    private ChainType targetChain;

    private String sourceToken; // null for native token

    @NotNull(message = "Source amount is required")
    @Positive(message = "Source amount must be positive")
    private BigDecimal sourceAmount;

    private String targetToken; // null for native token

    @NotNull(message = "Target amount is required")
    @Positive(message = "Target amount must be positive")
    private BigDecimal targetAmount;

    private String hashlock;

    private LocalDateTime timelockExpiry;
}
