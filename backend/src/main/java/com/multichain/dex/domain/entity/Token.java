package com.multichain.dex.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Tradeable token on a specific chain.
 * Address format differs by chain type:
 * <ul>
 *   <li>EVM: {@code 0x} + 40 hex chars (20 bytes)</li>
 *   <li>SUI: full Move type, e.g. {@code 0x2::sui::SUI}</li>
 * </ul>
 */
@Entity
@Table(name = "tokens", uniqueConstraints = @UniqueConstraint(columnNames = {"chain_id", "address"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chain_id", nullable = false)
    private Chain chain;

    @Column(nullable = false, length = 200)
    private String address;

    @Column(nullable = false, length = 20)
    private String symbol;

    @Column(length = 100)
    private String name;

    @Column(nullable = false)
    private int decimals;

    @Column(name = "is_native", nullable = false)
    @Builder.Default
    private boolean isNative = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
