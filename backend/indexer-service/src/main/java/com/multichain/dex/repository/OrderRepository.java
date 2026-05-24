package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderStatus;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.domain.enums.SwapPhase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {

    Optional<Order> findBySourceChain_IdAndOnChainOrderId(String sourceChainId, String onChainOrderId);

    Optional<Order> findBySourceChain_IdAndOnChainOrderIdAndOrderType(String sourceChainId, String onChainOrderId, OrderType orderType);

    /** Find a matched cross-chain order by creator+matcher addresses (case-insensitive). */
    @Query("""
        SELECT o FROM Order o
        WHERE o.orderType = 'CROSS_CHAIN'
          AND o.status = 'MATCHED'
          AND (
            (LOWER(o.creatorSourceAddress) = LOWER(:addr1) AND LOWER(o.matcherSourceAddress) = LOWER(:addr2))
            OR (LOWER(o.creatorSourceAddress) = LOWER(:addr2) AND LOWER(o.matcherSourceAddress) = LOWER(:addr1))
          )
        ORDER BY o.matchedAt DESC
        """)
    List<Order> findMatchedByAddresses(@Param("addr1") String addr1, @Param("addr2") String addr2);

    /** Orders that are not in a terminal phase — candidates for phase recomputation. */
    @Query("SELECT o FROM Order o WHERE o.phase NOT IN :terminalPhases")
    List<Order> findByPhaseNotIn(@Param("terminalPhases") Collection<SwapPhase> terminalPhases);

    /** Orders where any of the provided wallet addresses is creator or matcher. */
    @Query("""
        SELECT o FROM Order o
        WHERE (LOWER(o.creatorSourceAddress) IN :wallets OR LOWER(o.matcherSourceAddress) IN :wallets)
        ORDER BY o.createdAt DESC
        """)
    Page<Order> findByWallets(@Param("wallets") Collection<String> wallets, Pageable pageable);

    /** Active swaps: non-terminal orders where wallet is involved. */
    @Query("""
        SELECT o FROM Order o
        WHERE (LOWER(o.creatorSourceAddress) IN :wallets OR LOWER(o.matcherSourceAddress) IN :wallets)
          AND o.phase NOT IN :terminalPhases
        ORDER BY o.updatedAt DESC
        """)
    List<Order> findActiveByWallets(
            @Param("wallets") Collection<String> wallets,
            @Param("terminalPhases") Collection<SwapPhase> terminalPhases);

    /** History: terminal orders where wallet is involved. */
    @Query("""
        SELECT o FROM Order o
        WHERE (LOWER(o.creatorSourceAddress) IN :wallets OR LOWER(o.matcherSourceAddress) IN :wallets)
          AND o.phase IN :terminalPhases
        ORDER BY o.completedAt DESC NULLS LAST, o.updatedAt DESC
        """)
    Page<Order> findHistoryByWallets(
            @Param("wallets") Collection<String> wallets,
            @Param("terminalPhases") Collection<SwapPhase> terminalPhases,
            Pageable pageable);

    /** Count active (non-terminal) orders on a chain — used by indexer to limit scan scope. */
    long countBySourceChain_IdAndStatusNotIn(String chainId, Collection<OrderStatus> terminalStatuses);
}
