package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderStatus;
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

    /** Orders that are not in a terminal phase — candidates for phase recomputation. */
    @Query("SELECT o FROM Order o WHERE o.phase NOT IN :terminalPhases")
    List<Order> findByPhaseNotIn(@Param("terminalPhases") Collection<SwapPhase> terminalPhases);

    /** Orders where any of the provided wallet addresses is creator or matcher. */
    @Query("""
        SELECT o FROM Order o
        WHERE (LOWER(o.creator) IN :wallets OR LOWER(o.matcher) IN :wallets)
        ORDER BY o.createdAt DESC
        """)
    Page<Order> findByWallets(@Param("wallets") Collection<String> wallets, Pageable pageable);

    /** Active swaps: non-terminal orders where wallet is involved. */
    @Query("""
        SELECT o FROM Order o
        WHERE (LOWER(o.creator) IN :wallets OR LOWER(o.matcher) IN :wallets)
          AND o.phase NOT IN :terminalPhases
        ORDER BY o.updatedAt DESC
        """)
    List<Order> findActiveByWallets(
            @Param("wallets") Collection<String> wallets,
            @Param("terminalPhases") Collection<SwapPhase> terminalPhases);

    /** History: terminal orders where wallet is involved. */
    @Query("""
        SELECT o FROM Order o
        WHERE (LOWER(o.creator) IN :wallets OR LOWER(o.matcher) IN :wallets)
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
