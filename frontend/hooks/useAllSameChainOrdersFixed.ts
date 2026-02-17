'use client';

import { useMemo } from 'react';
import { useOrderBookForChain } from './useOrderBookForChain';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';
import { OrderStatus } from '@/types/order';
import type { UnifiedOrder } from './useAllUnifiedOrdersFixed';
import { sepolia, polygonAmoy } from 'wagmi/chains';

/**
 * Fetch same-chain orders from all supported chains
 * Fixed version with static hook calls instead of dynamic map
 */
export function useAllSameChainOrdersFixed() {
  // Call hooks statically for each chain (not in a loop!)
  const sepoliaResult = useOrderBookForChain(sepolia.id);
  const amoyResult = useOrderBookForChain(polygonAmoy.id);

  const isLoading = sepoliaResult.isLoading || amoyResult.isLoading;

  const orders = useMemo<UnifiedOrder[]>(() => {
    let allOrders: UnifiedOrder[] = [];

    // Process Sepolia orders
    const sepoliaFiltered = sepoliaResult.orders.filter((o) => o.status === OrderStatus.Active);
    const sepoliaEnriched = sepoliaFiltered.map((order) => {
      const sellTokenInfo = getTokenByAddress(sepolia.id, order.tokenToSell);
      const buyTokenInfo = getTokenByAddress(sepolia.id, order.tokenToBuy);

      const sellDecimals = sellTokenInfo?.decimals ?? 18;
      const buyDecimals = buyTokenInfo?.decimals ?? 18;

      const sellNum = parseFloat(formatUnits(order.sellAmount, sellDecimals));
      const buyNum = parseFloat(formatUnits(order.buyAmount, buyDecimals));

      const price = sellNum > 0 ? buyNum / sellNum : 0;
      const inversePrice = buyNum > 0 ? sellNum / buyNum : 0;

      return {
        id: order.id,
        creator: order.creator,
        sellToken: order.tokenToSell,
        buyToken: order.tokenToBuy,
        sellAmount: order.sellAmount,
        buyAmount: order.buyAmount,
        status: 'Active',
        expiresAt: BigInt(0),
        price,
        inversePrice,
        sellSymbol: sellTokenInfo?.symbol ?? '???',
        buySymbol: buyTokenInfo?.symbol ?? '???',
        formattedSellAmount: formatUnits(order.sellAmount, sellDecimals),
        formattedBuyAmount: formatUnits(order.buyAmount, buyDecimals),
        sourceChainIdNum: sepolia.id,
        targetChainIdNum: sepolia.id,
      } as UnifiedOrder;
    });

    // Process Polygon Amoy orders
    const amoyFiltered = amoyResult.orders.filter((o) => o.status === OrderStatus.Active);
    const amoyEnriched = amoyFiltered.map((order) => {
      const sellTokenInfo = getTokenByAddress(polygonAmoy.id, order.tokenToSell);
      const buyTokenInfo = getTokenByAddress(polygonAmoy.id, order.tokenToBuy);

      const sellDecimals = sellTokenInfo?.decimals ?? 18;
      const buyDecimals = buyTokenInfo?.decimals ?? 18;

      const sellNum = parseFloat(formatUnits(order.sellAmount, sellDecimals));
      const buyNum = parseFloat(formatUnits(order.buyAmount, buyDecimals));

      const price = sellNum > 0 ? buyNum / sellNum : 0;
      const inversePrice = buyNum > 0 ? sellNum / buyNum : 0;

      return {
        id: order.id,
        creator: order.creator,
        sellToken: order.tokenToSell,
        buyToken: order.tokenToBuy,
        sellAmount: order.sellAmount,
        buyAmount: order.buyAmount,
        status: 'Active',
        expiresAt: BigInt(0),
        price,
        inversePrice,
        sellSymbol: sellTokenInfo?.symbol ?? '???',
        buySymbol: buyTokenInfo?.symbol ?? '???',
        formattedSellAmount: formatUnits(order.sellAmount, sellDecimals),
        formattedBuyAmount: formatUnits(order.buyAmount, buyDecimals),
        sourceChainIdNum: polygonAmoy.id,
        targetChainIdNum: polygonAmoy.id,
      } as UnifiedOrder;
    });

    allOrders = [...sepoliaEnriched, ...amoyEnriched];
    return allOrders;
  }, [sepoliaResult.orders, amoyResult.orders]);

  return { orders, isLoading };
}
