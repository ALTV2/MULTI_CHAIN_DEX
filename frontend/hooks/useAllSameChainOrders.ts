'use client';

import { useMemo } from 'react';
import { getSupportedChainIds } from '@/lib/contracts/addresses';
import { useOrderBookForChain } from './useOrderBookForChain';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';
import { OrderStatus } from '@/types/order';
import type { UnifiedOrder } from './useAllUnifiedOrders';

/**
 * Fetch same-chain orders from all supported chains
 */
export function useAllSameChainOrders(params?: {}) {
  const allChainIds = getSupportedChainIds();
  // Filter for EVM chains only (same-chain orders are EVM-only)
  const chainIds = allChainIds
    .filter((id) => !String(id).startsWith('sui:'))
    .map((id) => Number(id));

  // Fetch orders from all chains
  const allChainResults = chainIds.map((chainId) => ({
    chainId,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    result: useOrderBookForChain(chainId),
  }));

  const isLoading = allChainResults.some((r) => r.result.isLoading);

  const orders = useMemo<UnifiedOrder[]>(() => {
    let allOrders: UnifiedOrder[] = [];

    for (const { chainId, result } of allChainResults) {
      const filtered = result.orders.filter((o) => o.status === OrderStatus.Active);

      // Enrich with metadata
      const enriched = filtered.map((order) => {
        const sellTokenInfo = getTokenByAddress(chainId, order.tokenToSell as `0x${string}`);
        const buyTokenInfo = getTokenByAddress(chainId, order.tokenToBuy as `0x${string}`);

        const sellDecimals = sellTokenInfo?.decimals ?? 18;
        const buyDecimals = buyTokenInfo?.decimals ?? 18;

        const sellNum = parseFloat(formatUnits(order.sellAmount, sellDecimals));
        const buyNum = parseFloat(formatUnits(order.buyAmount, buyDecimals));

        const price = sellNum > 0 ? buyNum / sellNum : 0;
        const inversePrice = buyNum > 0 ? sellNum / buyNum : 0;

        return {
          id: order.id,
          creator: order.creator,
          sellToken: order.tokenToSell as `0x${string}`,
          buyToken: order.tokenToBuy as `0x${string}`,
          sellAmount: order.sellAmount,
          buyAmount: order.buyAmount,
          status: 'Active',
          expiresAt: BigInt(0), // Same-chain orders don't expire
          price,
          inversePrice,
          sellSymbol: sellTokenInfo?.symbol ?? '???',
          buySymbol: buyTokenInfo?.symbol ?? '???',
          formattedSellAmount: formatUnits(order.sellAmount, sellDecimals),
          formattedBuyAmount: formatUnits(order.buyAmount, buyDecimals),
          sourceChainIdNum: chainId,
          targetChainIdNum: chainId, // Same chain
        } as UnifiedOrder;
      });

      allOrders = allOrders.concat(enriched);
    }

    return allOrders;
  }, [allChainResults]);

  return { orders, isLoading };
}
