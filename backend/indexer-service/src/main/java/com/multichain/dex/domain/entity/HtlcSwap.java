package com.multichain.dex.domain.entity;

import com.multichain.dex.domain.enums.HtlcRole;
import com.multichain.dex.domain.enums.HtlcStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigInteger;
import java.time.Instant;
import java.util.UUID;

/**
 * HTLC contract instance created for a cross-chain order.
 * Each cross-chain order has at most two HTLCs: one created by the order creator
 * and one by the matcher — identified by {@link #role}.
 *
 * <p>The revealed {@link #secret} is populated from on-chain events
 * (SwapWithdrawn), never from user input.</p>
 */
@Entity
@Table(name = "htlc_swaps", uniqueConstraints = @UniqueConstraint(columnNames = {"order_id", "role"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HtlcSwap {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private HtlcRole role;

    /** Chain where this HTLC contract lives. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chain_id", nullable = false)
    private Chain chain;

    /** EVM: bytes32 swap ID. SUI: computed swap ID. */
    @Column(name = "on_chain_swap_id", length = 66)
    private String onChainSwapId;

    /** SUI HTLC object ID (null for EVM HTLCs). */
    @Column(name = "sui_object_id", length = 66)
    private String suiObjectId;

    /** Address that locked the tokens (initiator of this HTLC). */
    @Column(nullable = false, length = 200)
    private String initiator;

    /** Address that can withdraw (participant of this HTLC). */
    @Column(nullable = false, length = 200)
    private String participant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id")
    private Token token;

    @Column(precision = 78)
    private BigInteger amount;

    /** keccak256 hash of the secret — bytes32 hex. */
    @Column(length = 66)
    private String hashlock;

    /** Timestamp after which the initiator can reclaim locked tokens. */
    @Column
    private Instant timelock;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    @Builder.Default
    private HtlcStatus status = HtlcStatus.ACTIVE;

    /** Secret revealed on-chain via SwapWithdrawn event. Never user-submitted. */
    @Column(length = 66)
    private String secret;

    @Column(name = "creation_tx_hash", length = 100)
    private String creationTxHash;

    @Column(name = "withdraw_tx_hash", length = 100)
    private String withdrawTxHash;

    @Column(name = "refund_tx_hash", length = 100)
    private String refundTxHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    /** Whether the timelock has expired and a refund is possible. */
    public boolean isExpired() {
        return timelock != null && Instant.now().isAfter(timelock) && status == HtlcStatus.ACTIVE;
    }
}
