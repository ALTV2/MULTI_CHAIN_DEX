'use client';

import { useMemo } from 'react';
import { useCrossChainOrdersForTarget, type CrossChainOrder } from './useCrossChainOrders';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';
import { getSupportedChainIds } from '@/lib/contracts/addresses';

export interface UnifiedOrder extends CrossChainOrder {
  price: number;       // buyAmount / sellAmount ratio
  inversePrice: number; // sellAmount / buyAmount ratio
  sellSymbol: string;
  buySymbol: string;
  formattedSellAmount: string;
  formattedBuyAmount: string;
  // Actual chain IDs as numbers
  sourceChainIdNum: number;
  targetChainIdNum: number;
}

export function useAllUnifiedOrders(params?: {}) {
  const allChainIds = getSupportedChainIds();
  // Filter for EVM chains only (cross-chain orders use EVM contracts)
  const chainIds = allChainIds.filter((id) => typeof id === 'number') as number[];

  // Fetch orders from all chain pairs
  const allChainResults = chainIds.flatMap((sourceChainId) =>
    chainIds
      .filter((targetChainId) => targetChainId !== sourceChainId)
      .map((targetChainId) => ({
        sourceChainId,
        targetChainId,
        // eslint-disable-next-line react-hooks/rules-of-hooks
        result: useCrossChainOrdersForTarget(sourceChainId, targetChainId),
      }))
  );

  const isLoading = allChainResults.some((r) => r.result.isLoading);

  const orders = useMemo<UnifiedOrder[]>(() => {
    let allOrders: UnifiedOrder[] = [];

    // Collect orders from all chain pairs
    for (const { sourceChainId, targetChainId, result } of allChainResults) {
      const filtered = result.orders.filter((o) => o.status === 'Active');

      // Enrich with metadata
      const enriched = filtered.map((order) => {
        const sellTokenInfo = getTokenByAddress(sourceChainId, order.sellToken);
        const buyTokenInfo = getTokenByAddress(targetChainId, order.buyToken);

        const sellDecimals = sellTokenInfo?.decimals ?? 18;
        const buyDecimals = buyTokenInfo?.decimals ?? 18;

        const sellNum = parseFloat(formatUnits(order.sellAmount, sellDecimals));
        const buyNum = parseFloat(formatUnits(order.buyAmount, buyDecimals));

        const price = sellNum > 0 ? buyNum / sellNum : 0;
        const inversePrice = buyNum > 0 ? sellNum / buyNum : 0;

        return {
          ...order,
          price,
          inversePrice,
          sellSymbol: sellTokenInfo?.symbol ?? '???',
          buySymbol: buyTokenInfo?.symbol ?? '???',
          formattedSellAmount: formatUnits(order.sellAmount, sellDecimals),
          formattedBuyAmount: formatUnits(order.buyAmount, buyDecimals),
          sourceChainIdNum: sourceChainId,
          targetChainIdNum: targetChainId,
        };
      });

      allOrders = allOrders.concat(enriched);
    }

    // Sort by price (best price first)
    return allOrders.sort((a, b) => a.price - b.price);
  }, [allChainResults]);

  return { orders, isLoading };
}
