package com.multichain.dex.domain.entity;

import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.domain.enums.SwapStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "swap_history", indexes = {
    @Index(name = "idx_swap_user", columnList = "user_id"),
    @Index(name = "idx_swap_status", columnList = "status"),
    @Index(name = "idx_swap_htlc_id", columnList = "htlcSwapId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SwapHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 66)
    private String htlcSwapId;

    @Column(length = 66)
    private String crossChainOrderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChainType sourceChain;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChainType targetChain;

    @Column(length = 42)
    private String sourceToken;

    @Column(precision = 36, scale = 18)
    private BigDecimal sourceAmount;

    @Column(length = 42)
    private String targetToken;

    @Column(precision = 36, scale = 18)
    private BigDecimal targetAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SwapStatus status = SwapStatus.PENDING;

    @Column(length = 66)
    private String sourceTxHash;

    @Column(length = 66)
    private String targetTxHash;

    @Column(length = 66)
    private String hashlock;

    private LocalDateTime timelockExpiry;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    private LocalDateTime completedAt;
}
