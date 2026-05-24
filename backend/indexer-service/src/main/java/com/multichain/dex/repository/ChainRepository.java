package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.Chain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChainRepository extends JpaRepository<Chain, String> {

    List<Chain> findByPollingEnabledTrue();
}
