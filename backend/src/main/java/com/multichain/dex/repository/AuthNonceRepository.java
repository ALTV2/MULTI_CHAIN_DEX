package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.AuthNonce;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuthNonceRepository extends JpaRepository<AuthNonce, UUID> {

    Optional<AuthNonce> findByWalletAddressAndUsedFalseAndExpiresAtAfter(
        String walletAddress, LocalDateTime now);

    Optional<AuthNonce> findByNonceAndUsedFalseAndExpiresAtAfter(
        String nonce, LocalDateTime now);

    @Modifying
    @Query("DELETE FROM AuthNonce a WHERE a.expiresAt < :now OR a.used = true")
    void deleteExpiredOrUsedNonces(@Param("now") LocalDateTime now);
}
