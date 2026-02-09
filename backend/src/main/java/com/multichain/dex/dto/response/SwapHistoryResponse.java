package com.multichain.dex.dto.response;

import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.domain.enums.SwapStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SwapHistoryResponse {
    private UUID id;
    private String htlcSwapId;
    private String crossChainOrderId;
    private ChainType sourceChain;
    private ChainType targetChain;
    private String sourceToken;
    private BigDecimal sourceAmount;
    private String targetToken;
    private BigDecimal targetAmount;
    private SwapStatus status;
    private String sourceTxHash;
    private String targetTxHash;
    private String hashlock;
    private LocalDateTime timelockExpiry;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
