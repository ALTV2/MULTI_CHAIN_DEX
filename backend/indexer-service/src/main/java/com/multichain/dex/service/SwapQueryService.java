package com.multichain.dex.service;

import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.HtlcRole;
import com.multichain.dex.domain.enums.HtlcStatus;
import com.multichain.dex.dto.OrderResponse;
import com.multichain.dex.dto.SwapResponse;
import com.multichain.dex.repository.HtlcSwapRepository;
import com.multichain.dex.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Query service for active swaps and history — enriches orders with HTLC details.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SwapQueryService {

    private final OrderRepository orderRepo;
    private final HtlcSwapRepository htlcRepo;

    /**
     * Active swaps: non-terminal orders where any provided wallet is involved.
     * Each result includes HTLC details and the caller's role.
     */
    public List<SwapResponse> findActiveSwaps(Collection<String> wallets) {
        var lowerWallets = normalize(wallets);
        var orders = orderRepo.findActiveByWallets(lowerWallets, PhaseCalculator.TERMINAL_PHASES);
        return orders.stream()
                .map(order -> toSwapResponse(order, lowerWallets))
                .collect(Collectors.toList());
    }

    /**
     * Swap history: terminal orders where any provided wallet is involved.
     */
    public Page<SwapResponse> findHistory(Collection<String> wallets, Pageable pageable) {
        var lowerWallets = normalize(wallets);
        return orderRepo.findHistoryByWallets(lowerWallets, PhaseCalculator.TERMINAL_PHASES, pageable)
                .map(order -> toSwapResponse(order, lowerWallets));
    }

    private SwapResponse toSwapResponse(Order order, Collection<String> wallets) {
        HtlcSwap creatorHtlc = htlcRepo.findByOrderIdAndRole(order.getId(), HtlcRole.CREATOR).orElse(null);
        HtlcSwap matcherHtlc = htlcRepo.findByOrderIdAndRole(order.getId(), HtlcRole.MATCHER).orElse(null);

        String role = determineRole(order, wallets);
        String revealedSecret = findRevealedSecret(creatorHtlc, matcherHtlc);

        return new SwapResponse(
                OrderResponse.from(order),
                role,
                order.getPhase().name(),
                SwapResponse.HtlcInfo.from(creatorHtlc),
                SwapResponse.HtlcInfo.from(matcherHtlc),
                revealedSecret
        );
    }

    /**
     * Determine the role of the querying wallet(s) in the order.
     * If a wallet is the creator, role is "creator"; if matcher, "matcher".
     * If both (self-trade in testing), prefer "creator".
     */
    private String determineRole(Order order, Collection<String> wallets) {
        boolean isCreator = wallets.contains(order.getCreatorSourceAddress().toLowerCase());
        boolean isMatcher = order.getMatcherSourceAddress() != null && wallets.contains(order.getMatcherSourceAddress().toLowerCase());

        if (isCreator) return "creator";
        if (isMatcher) return "matcher";
        return "unknown";
    }

    /**
     * Find the on-chain revealed secret from either HTLC (whichever was withdrawn first).
     */
    private String findRevealedSecret(HtlcSwap creatorHtlc, HtlcSwap matcherHtlc) {
        if (creatorHtlc != null && creatorHtlc.getStatus() == HtlcStatus.WITHDRAWN && creatorHtlc.getSecret() != null) {
            return creatorHtlc.getSecret();
        }
        if (matcherHtlc != null && matcherHtlc.getStatus() == HtlcStatus.WITHDRAWN && matcherHtlc.getSecret() != null) {
            return matcherHtlc.getSecret();
        }
        return null;
    }

    private List<String> normalize(Collection<String> wallets) {
        return wallets.stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }
}
