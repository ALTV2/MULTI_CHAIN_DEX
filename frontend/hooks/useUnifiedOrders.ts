'use client';

import { useMemo } from 'react';
import { useCrossChainOrdersForTarget, type CrossChainOrder } from './useCrossChainOrders';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';

export interface UnifiedOrder extends CrossChainOrder {
  price: number;       // buyAmount / sellAmount ratio
  inversePrice: number; // sellAmount / buyAmount ratio
  sellSymbol: string;
  buySymbol: string;
  formattedSellAmount: string;
  formattedBuyAmount: string;
}

export function useUnifiedOrders(params: {
  sourceChainId: number;
  targetChainId: number;
  sourceToken?: string;
  targetToken?: string;
}) {
  const { sourceChainId, targetChainId, sourceToken, targetToken } = params;

  const { orders: rawOrders, isLoading, error, refetch } = useCrossChainOrdersForTarget(
    sourceChainId,
    targetChainId
  );

  const orders = useMemo<UnifiedOrder[]>(() => {
    let filtered = rawOrders.filter((o) => o.status === 'Active');

    // Filter by token pair if specified
    if (sourceToken) {
      filtered = filtered.filter(
        (o) => o.sellToken.toLowerCase() === sourceToken.toLowerCase()
      );
    }
    if (targetToken) {
      filtered = filtered.filter(
        (o) => o.buyToken.toLowerCase() === targetToken.toLowerCase()
      );
    }

    // Enrich with metadata and sort by price
    return filtered
      .map((order) => {
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
        };
      })
      .sort((a, b) => a.price - b.price); // Best price first (lowest cost per sell token)
  }, [rawOrders, sourceToken, targetToken, sourceChainId, targetChainId]);

  return { orders, isLoading, error, refetch };
}
