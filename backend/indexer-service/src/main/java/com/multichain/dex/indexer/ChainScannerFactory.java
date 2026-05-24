package com.multichain.dex.indexer;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.enums.ChainType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Resolves the correct {@link ChainScanner} implementation for a given chain.
 */
@Component
@RequiredArgsConstructor
public class ChainScannerFactory {

    private final EvmChainScanner evmScanner;
    private final SuiChainScanner suiScanner;

    /**
     * Get the scanner for the given chain based on its type.
     *
     * @param chain the chain
     * @return appropriate scanner
     * @throws IllegalArgumentException if chain type is unknown
     */
    public ChainScanner getScanner(Chain chain) {
        return switch (chain.getChainType()) {
            case EVM -> evmScanner;
            case SUI -> suiScanner;
        };
    }
}
