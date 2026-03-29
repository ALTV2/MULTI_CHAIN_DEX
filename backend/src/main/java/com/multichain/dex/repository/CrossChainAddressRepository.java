package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.CrossChainAddress;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrossChainAddressRepository extends JpaRepository<CrossChainAddress, String> {
}
