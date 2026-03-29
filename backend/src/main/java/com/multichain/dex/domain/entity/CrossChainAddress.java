package com.multichain.dex.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cross_chain_addresses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CrossChainAddress {

    @Id
    @Column(name = "evm_address", length = 200)
    private String evmAddress;

    @Column(name = "sui_address", nullable = false, length = 200)
    private String suiAddress;

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
