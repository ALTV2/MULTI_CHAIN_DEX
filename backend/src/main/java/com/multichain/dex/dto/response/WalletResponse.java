package com.multichain.dex.dto.response;

import com.multichain.dex.domain.enums.ChainType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletResponse {
    private UUID id;
    private String address;
    private ChainType chain;
    private String label;
    private boolean imported;
    private boolean isPrimary;
    private boolean hasPrivateKey;
    private LocalDateTime createdAt;
}
