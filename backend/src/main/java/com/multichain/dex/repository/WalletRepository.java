package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Wallet;
import com.multichain.dex.domain.enums.ChainType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, UUID> {

    List<Wallet> findByUserId(UUID userId);

    List<Wallet> findByUserIdAndChain(UUID userId, ChainType chain);

    Optional<Wallet> findByUserIdAndAddressAndChain(UUID userId, String address, ChainType chain);

    boolean existsByUserIdAndAddressAndChain(UUID userId, String address, ChainType chain);

    Optional<Wallet> findByUserIdAndIsPrimaryTrue(UUID userId);
}
