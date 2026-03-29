package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.enums.HtlcRole;
import com.multichain.dex.domain.enums.HtlcStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HtlcSwapRepository extends JpaRepository<HtlcSwap, UUID> {

    Optional<HtlcSwap> findByOrderIdAndRole(UUID orderId, HtlcRole role);

    List<HtlcSwap> findByOrderId(UUID orderId);

    /** All active HTLCs on a given chain — indexer polls these for status changes. */
    @Query("SELECT h FROM HtlcSwap h WHERE h.chain.id = :chainId AND h.status = :status")
    List<HtlcSwap> findByChainIdAndStatus(@Param("chainId") String chainId, @Param("status") HtlcStatus status);

    Optional<HtlcSwap> findByOnChainSwapId(String onChainSwapId);

    Optional<HtlcSwap> findBySuiObjectId(String suiObjectId);

    Optional<HtlcSwap> findByHashlockAndChainIdAndRole(String hashlock, String chainId, HtlcRole role);

    /** Find first HTLC with given hashlock across ALL chains (indexed lookup, no full scan). */
    Optional<HtlcSwap> findFirstByHashlockIgnoreCase(String hashlock);
}
