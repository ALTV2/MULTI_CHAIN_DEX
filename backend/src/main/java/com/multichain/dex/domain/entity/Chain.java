package com.multichain.dex.domain.entity;

import com.multichain.dex.domain.enums.ChainType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * Supported blockchain. Drives indexer polling and frontend chain selector.
 * The {@code id} is the chain identifier: numeric string for EVM (e.g. "11155111"),
 * namespaced string for SUI (e.g. "sui:testnet").
 */
@Entity
@Table(name = "chains")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chain {

    @Id
    @Column(length = 50)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "short_name", nullable = false, length = 30)
    private String shortName;

    @Enumerated(EnumType.STRING)
    @Column(name = "chain_type", nullable = false, length = 10)
    private ChainType chainType;

    @Column(name = "rpc_url", nullable = false, length = 500)
    private String rpcUrl;

    @Column(name = "block_explorer", length = 500)
    private String blockExplorer;

    @Column(name = "native_symbol", nullable = false, length = 10)
    private String nativeSymbol;

    @Column(name = "native_decimals", nullable = false)
    private int nativeDecimals;

    /** Contract addresses: {"orderBook":"0x...", "htlc":"0x...", "ccob":"0x..."} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, String> contracts;

    @Column(name = "polling_enabled", nullable = false)
    @Builder.Default
    private boolean pollingEnabled = true;

    /** EVM: last processed block number for event log scanning. */
    @Column(name = "last_indexed_block")
    @Builder.Default
    private long lastIndexedBlock = 0;

    /** EVM/SUI: last scanned on-chain order ID (for incremental order scanning). */
    @Column(name = "last_indexed_order_id")
    @Builder.Default
    private long lastIndexedOrderId = 0;

    /** SUI: cursor for SwapCreated event queries. */
    @Column(name = "last_event_cursor", length = 500)
    private String lastEventCursor;

    /** SUI: separate cursor for SwapWithdrawn event queries. */
    @Column(name = "last_withdrawn_cursor", length = 500)
    private String lastWithdrawnCursor;

    @Column(name = "last_polled_at")
    private Instant lastPolledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    /** Helper: get a contract address by key, e.g. "htlc", "ccob", "orderBook". */
    public String getContract(String key) {
        return contracts != null ? contracts.get(key) : null;
    }

    public boolean isEvm() {
        return chainType == ChainType.EVM;
    }

    public boolean isSui() {
        return chainType == ChainType.SUI;
    }
}
