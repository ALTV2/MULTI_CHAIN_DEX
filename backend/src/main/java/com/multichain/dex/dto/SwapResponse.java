package com.multichain.dex.dto;

import com.multichain.dex.domain.entity.HtlcSwap;

import java.time.Instant;

/**
 * Active swap or history entry enriched with HTLC details.
 */
public record SwapResponse(
        OrderResponse order,
        String role,
        String phase,
        HtlcInfo creatorHtlc,
        HtlcInfo matcherHtlc,
        String revealedSecret
) {
    /**
     * HTLC details for one side of the swap.
     */
    public record HtlcInfo(
            String chainId,
            String onChainSwapId,
            String suiObjectId,
            String status,
            String hashlock,
            Long timelock,
            TokenInfo token,
            String amount,
            String creationTxHash,
            String withdrawTxHash,
            Instant createdAt
    ) {
        public static HtlcInfo from(HtlcSwap htlc) {
            if (htlc == null) return null;
            return new HtlcInfo(
                    htlc.getChain().getId(),
                    htlc.getOnChainSwapId(),
                    htlc.getSuiObjectId(),
                    htlc.getStatus().name(),
                    htlc.getHashlock(),
                    htlc.getTimelock() != null ? htlc.getTimelock().getEpochSecond() : null,
                    htlc.getToken() != null ? TokenInfo.from(htlc.getToken()) : null,
                    htlc.getAmount() != null ? htlc.getAmount().toString() : null,
                    htlc.getCreationTxHash(),
                    htlc.getWithdrawTxHash(),
                    htlc.getCreatedAt()
            );
        }
    }
}
