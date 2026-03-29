package com.multichain.dex.domain.entity;

import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.domain.enums.SwapPhase;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Unified order from any chain and order type (same-chain or cross-chain).
 * Indexed from on-chain OrderBook / CrossChainOrderBook / SUI CCOB contracts.
 *
 * <p>The natural key is {@code (sourceChainId, onChainOrderId)}.
 * Phase is recomputed by {@link com.multichain.dex.service.PhaseCalculator}
 * on every indexer cycle for non-terminal orders.</p>
 */
@Entity
@Table(name = "orders", uniqueConstraints = @UniqueConstraint(columnNames = {"source_chain_id", "on_chain_order_id", "order_type"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_chain_id", nullable = false)
    private Chain sourceChain;

    @Column(name = "on_chain_order_id", nullable = false, length = 100)
    private String onChainOrderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false, length = 20)
    private OrderType orderType;

    /** Creator's blockchain address. */
    @Column(nullable = false, length = 200)
    private String creator;

    /** Matcher's blockchain address (null until matched). */
    @Column(length = 200)
    private String matcher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sell_token_id")
    private Token sellToken;

    @Column(name = "sell_amount", nullable = false, precision = 78)
    private BigInteger sellAmount;

    /** May be null for cross-chain orders where buyToken is on an unsupported chain or uses a placeholder address. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buy_token_id")
    private Token buyToken;

    @Column(name = "buy_amount", nullable = false, precision = 78)
    private BigInteger buyAmount;

    /** Target chain for cross-chain orders; null for same-chain. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_chain_id")
    private Chain targetChain;

    /** Receiving address on the target chain. */
    @Column(name = "target_address", length = 200)
    private String targetAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrderStatus status = OrderStatus.ACTIVE;

    /** Computed UI phase — kept in sync by PhaseCalculator. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private SwapPhase phase = SwapPhase.ORDER_CREATED;

    /** SUI same-chain metadata: {"orderObjectId":"0x...", "coinAType":"...", "coinBType":"...", "pairId":"..."} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sui_same_chain_meta")
    private Map<String, String> suiSameChainMeta;

    /** Transaction hash for same-chain direct execution via Trade contract. */
    @Column(name = "execution_tx_hash", length = 100)
    private String executionTxHash;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Column(name = "matched_at")
    private Instant matchedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    /** Convenience: source chain id without loading the relation. */
    public String getSourceChainId() {
        return sourceChain != null ? sourceChain.getId() : null;
    }

    /** Convenience: target chain id without loading the relation. */
    public String getTargetChainId() {
        return targetChain != null ? targetChain.getId() : null;
    }
}
