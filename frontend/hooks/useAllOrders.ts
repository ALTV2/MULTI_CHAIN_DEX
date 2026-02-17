'use client';

import { useMemo } from 'react';
import { useAllUnifiedOrdersFixed, type UnifiedOrder } from './useAllUnifiedOrdersFixed';
import { useAllSameChainOrdersFixed } from './useAllSameChainOrdersFixed';
import { getTokenByAddress } from '@/lib/constants/tokens';

/**
 * Unified hook that fetches ALL orders:
 * - Same-chain orders from all supported chains
 * - Cross-chain orders from all chain pairs
 * Filters by token symbol (not address) to work across chains
 */
export function useAllOrders(params: {
  sourceChainId?: number;
  targetChainId?: number;
  sourceToken?: string;
  targetToken?: string;
}) {
  const { sourceChainId, targetChainId, sourceToken, targetToken } = params;

  // Fetch ALL cross-chain orders (no filtering by address) - Fixed version with static hooks
  const { orders: crossChainOrders, isLoading: isCrossChainLoading } = useAllUnifiedOrdersFixed({});

  // Fetch ALL same-chain orders (no filtering by address) - Fixed version with static hooks
  const { orders: sameChainOrders, isLoading: isSameChainLoading } = useAllSameChainOrdersFixed();

  const isLoading = isCrossChainLoading || isSameChainLoading;

  // Get token symbols from selected addresses
  const sourceTokenSymbol = sourceChainId && sourceToken
    ? getTokenByAddress(sourceChainId, sourceToken as `0x${string}`)?.symbol
    : undefined;
  const targetTokenSymbol = targetChainId && targetToken
    ? getTokenByAddress(targetChainId, targetToken as `0x${string}`)?.symbol
    : undefined;

  // Combine and filter by symbol + exact chain match
  const allOrders = useMemo(() => {
    console.log('🎯 useAllOrders filtering...');
    console.log('  Filter params:', {
      sourceChainId,
      targetChainId,
      sourceTokenSymbol,
      targetTokenSymbol,
    });

    let combined = [...crossChainOrders, ...sameChainOrders];
    console.log('  Initial combined orders:', combined.length);

    // Filter by token symbol (works across chains)
    if (sourceTokenSymbol) {
      const before = combined.length;
      combined = combined.filter((o) => o.sellSymbol === sourceTokenSymbol);
      console.log(`  After source token filter (${sourceTokenSymbol}): ${before} → ${combined.length}`);
    }
    if (targetTokenSymbol) {
      const before = combined.length;
      combined = combined.filter((o) => o.buySymbol === targetTokenSymbol);
      console.log(`  After target token filter (${targetTokenSymbol}): ${before} → ${combined.length}`);
    }

    // Filter by exact blockchain match
    if (sourceChainId && targetChainId) {
      const isSameChain = sourceChainId === targetChainId;
      const before = combined.length;

      if (isSameChain) {
        // Same-chain mode: only show orders from this specific chain
        combined = combined.filter((o) =>
          o.sourceChainIdNum === sourceChainId && o.targetChainIdNum === targetChainId
        );
      } else {
        // Cross-chain mode: only show orders matching exact source->target chain pair
        combined = combined.filter((o) =>
          o.sourceChainIdNum === sourceChainId && o.targetChainIdNum === targetChainId
        );
      }
      console.log(`  After chain filter (${sourceChainId} → ${targetChainId}): ${before} → ${combined.length}`);
    }

    console.log('  📋 Final filtered orders:', combined.length);
    combined.forEach((o, i) => {
      console.log(`    Result ${i}:`, {
        id: o.id.toString(),
        chains: `${o.sourceChainIdNum} → ${o.targetChainIdNum}`,
        tokens: `${o.sellSymbol} → ${o.buySymbol}`,
      });
    });

    // Sort by price (best price first)
    return combined.sort((a, b) => a.price - b.price);
  }, [crossChainOrders, sameChainOrders, sourceTokenSymbol, targetTokenSymbol, sourceChainId, targetChainId]);

  return {
    orders: allOrders,
    isLoading,
    crossChainCount: crossChainOrders.length,
    sameChainCount: sameChainOrders.length,
  };
}
