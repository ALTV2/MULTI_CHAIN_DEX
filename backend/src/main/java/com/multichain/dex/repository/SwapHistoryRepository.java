package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.SwapHistory;
import com.multichain.dex.domain.enums.SwapStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SwapHistoryRepository extends JpaRepository<SwapHistory, UUID> {

    Page<SwapHistory> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<SwapHistory> findByUserIdAndStatus(UUID userId, SwapStatus status);

    List<SwapHistory> findByUserIdAndStatusIn(UUID userId, List<SwapStatus> statuses);

    Optional<SwapHistory> findByHtlcSwapId(String htlcSwapId);

    @Query("SELECT s FROM SwapHistory s WHERE s.status IN :statuses AND s.timelockExpiry < :now")
    List<SwapHistory> findExpiredSwaps(@Param("statuses") List<SwapStatus> statuses, @Param("now") LocalDateTime now);

    @Query("SELECT s FROM SwapHistory s WHERE s.status = :status")
    List<SwapHistory> findByStatus(@Param("status") SwapStatus status);

    @Query("SELECT COUNT(s) FROM SwapHistory s WHERE s.user.id = :userId AND s.status = :status")
    long countByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") SwapStatus status);
}
