'use client';

import { useMemo } from 'react';
import { useCrossChainOrdersForTarget, type CrossChainOrder } from './useCrossChainOrders';
import { getTokenByAddress, evmPlaceholderToSuiToken } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { SUI_NUMERIC_CHAIN_ID } from '@/lib/contracts/addresses';

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

function enrichOrders(
  orders: CrossChainOrder[],
  sourceChainId: number,
  targetChainId: number | string,
  targetChainIdForTokenLookup: number | string,
): UnifiedOrder[] {
  return orders
    .filter((o) => o.status === 'Active')
    .map((order) => {
      const sellTokenInfo = getTokenByAddress(sourceChainId, order.sellToken);

      // For EVM→SUI: buyToken is a placeholder — resolve to SUI token
      const isSuiTarget = typeof targetChainIdForTokenLookup === 'string';
      let buyTokenAddr: string = order.buyToken;
      if (isSuiTarget) {
        const suiToken = evmPlaceholderToSuiToken(order.buyToken);
        if (suiToken) buyTokenAddr = suiToken;
      }
      const buyTokenInfo = getTokenByAddress(targetChainIdForTokenLookup, buyTokenAddr);

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
        targetChainIdNum: targetChainIdForTokenLookup,
      };
    });
}

/**
 * Fixed version with static hook calls instead of dynamic loops
 * Fetches cross-chain orders from all supported chain pairs
 */
export function useAllUnifiedOrdersFixed(params?: {}) {
  // Call hooks statically for each chain pair (not in a loop!)
  // EVM ↔ EVM
  const sepoliaToAmoy = useCrossChainOrdersForTarget(sepolia.id, polygonAmoy.id);
  const amoyToSepolia = useCrossChainOrdersForTarget(polygonAmoy.id, sepolia.id);
  // EVM → SUI (targetChainId = 101 on-chain, maps to 'sui:testnet')
  const sepoliaToSui = useCrossChainOrdersForTarget(sepolia.id, SUI_NUMERIC_CHAIN_ID);
  const amoyToSui = useCrossChainOrdersForTarget(polygonAmoy.id, SUI_NUMERIC_CHAIN_ID);

  const isLoading = sepoliaToAmoy.isLoading || amoyToSepolia.isLoading || sepoliaToSui.isLoading || amoyToSui.isLoading;

  const orders = useMemo<UnifiedOrder[]>(() => {
    const allOrders = [
      ...enrichOrders(sepoliaToAmoy.orders, sepolia.id, polygonAmoy.id, polygonAmoy.id),
      ...enrichOrders(amoyToSepolia.orders, polygonAmoy.id, sepolia.id, sepolia.id),
      // EVM→SUI: numeric 101 on-chain, but display as 'sui:testnet'
      ...enrichOrders(sepoliaToSui.orders, sepolia.id, SUI_NUMERIC_CHAIN_ID, 'sui:testnet'),
      ...enrichOrders(amoyToSui.orders, polygonAmoy.id, SUI_NUMERIC_CHAIN_ID, 'sui:testnet'),
    ];

    return allOrders.sort((a, b) => a.price - b.price);
  }, [sepoliaToAmoy.orders, amoyToSepolia.orders, sepoliaToSui.orders, amoyToSui.orders]);

  return { orders, isLoading };
}
