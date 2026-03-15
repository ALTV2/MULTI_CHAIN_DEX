'use client';

import { useMemo } from 'react';
import { useCrossChainOrdersForTarget, type CrossChainOrder } from './useCrossChainOrders';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';

export interface SuiSameChainMeta {
  orderObjectId: string;
  coinAType: string;
  coinBType: string;
  pairId: string;
}

export interface UnifiedOrder extends CrossChainOrder {
  price: number;       // buyAmount / sellAmount ratio
  inversePrice: number; // sellAmount / buyAmount ratio
  sellSymbol: string;
  buySymbol: string;
  formattedSellAmount: string;
  formattedBuyAmount: string;
  // Actual chain IDs as numbers (EVM) or strings (SUI)
  sourceChainIdNum: number | string;
  targetChainIdNum: number | string;
  // Present only for SUI same-chain orders
  suiSameChainMeta?: SuiSameChainMeta;
}

/**
 * Fixed version with static hook calls instead of dynamic loops
 * Fetches cross-chain orders from all supported chain pairs
 */
export function useAllUnifiedOrdersFixed(params?: {}) {
  // Call hooks statically for each chain pair (not in a loop!)
  const sepoliaToAmoy = useCrossChainOrdersForTarget(sepolia.id, polygonAmoy.id);
  const amoyToSepolia = useCrossChainOrdersForTarget(polygonAmoy.id, sepolia.id);

  const isLoading = sepoliaToAmoy.isLoading || amoyToSepolia.isLoading;

  const orders = useMemo<UnifiedOrder[]>(() => {
    console.log('🔄 useAllUnifiedOrdersFixed processing...');
    console.log('  Sepolia → Amoy raw orders:', sepoliaToAmoy.orders.length, sepoliaToAmoy.orders);
    console.log('  Amoy → Sepolia raw orders:', amoyToSepolia.orders.length, amoyToSepolia.orders);

    let allOrders: UnifiedOrder[] = [];

    // Process Sepolia → Amoy orders
    const sepoliaToAmoyFiltered = sepoliaToAmoy.orders.filter((o) => o.status === 'Active');
    console.log('  Sepolia → Amoy filtered (Active only):', sepoliaToAmoyFiltered.length);
    const sepoliaToAmoyEnriched = sepoliaToAmoyFiltered.map((order) => {
      const sellTokenInfo = getTokenByAddress(sepolia.id, order.sellToken);
      const buyTokenInfo = getTokenByAddress(polygonAmoy.id, order.buyToken);

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
        sourceChainIdNum: sepolia.id,
        targetChainIdNum: polygonAmoy.id,
      };
    });

    // Process Amoy → Sepolia orders
    const amoyToSepoliaFiltered = amoyToSepolia.orders.filter((o) => o.status === 'Active');
    console.log('  Amoy → Sepolia filtered (Active only):', amoyToSepoliaFiltered.length);
    const amoyToSepoliaEnriched = amoyToSepoliaFiltered.map((order) => {
      const sellTokenInfo = getTokenByAddress(polygonAmoy.id, order.sellToken);
      const buyTokenInfo = getTokenByAddress(sepolia.id, order.buyToken);

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
        sourceChainIdNum: polygonAmoy.id,
        targetChainIdNum: sepolia.id,
      };
    });

    allOrders = [...sepoliaToAmoyEnriched, ...amoyToSepoliaEnriched];

    console.log('  📊 Combined enriched orders:', allOrders.length);
    allOrders.forEach((o, i) => {
      console.log(`    Order ${i}:`, {
        id: o.id.toString(),
        sourceChain: o.sourceChainIdNum,
        targetChain: o.targetChainIdNum,
        sellSymbol: o.sellSymbol,
        buySymbol: o.buySymbol,
        status: o.status,
      });
    });

    // Sort by price (best price first)
    return allOrders.sort((a, b) => a.price - b.price);
  }, [sepoliaToAmoy.orders, amoyToSepolia.orders]);

  return { orders, isLoading };
}
