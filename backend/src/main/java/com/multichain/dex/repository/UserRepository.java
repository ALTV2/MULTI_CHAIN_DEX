package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByPrimaryWalletAddress(String walletAddress);

    Optional<User> findByEmail(String email);

    boolean existsByPrimaryWalletAddress(String walletAddress);

    boolean existsByEmail(String email);
}
