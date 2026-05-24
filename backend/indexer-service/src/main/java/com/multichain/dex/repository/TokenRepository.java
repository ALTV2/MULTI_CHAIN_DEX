package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Token;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TokenRepository extends JpaRepository<Token, UUID> {

    List<Token> findByChainId(String chainId);

    Optional<Token> findByChainIdAndAddressIgnoreCase(String chainId, String address);

    Optional<Token> findByChainIdAndSymbolIgnoreCase(String chainId, String symbol);
}
