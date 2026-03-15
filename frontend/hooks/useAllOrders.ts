'use client';

import { useMemo } from 'react';
import { useAllUnifiedOrdersFixed, type UnifiedOrder } from './useAllUnifiedOrdersFixed';
import { useAllSameChainOrdersFixed } from './useAllSameChainOrdersFixed';
import { useSuiOrders } from './useSuiOrders';
import { getTokenByAddress } from '@/lib/constants/tokens';

/**
 * Unified hook that fetches ALL orders:
 * - Same-chain orders from all supported chains (EVM + SUI)
 * - Cross-chain orders from all chain pairs
 * Filters by token symbol (not address) to work across chains
 */
export function useAllOrders(params: {
  sourceChainId?: number | string;
  targetChainId?: number | string;
  sourceToken?: string;
  targetToken?: string;
}) {
  const { sourceChainId, targetChainId, sourceToken, targetToken } = params;

  // Fetch ALL cross-chain orders (no filtering by address) - Fixed version with static hooks
  const { orders: crossChainOrders, isLoading: isCrossChainLoading } = useAllUnifiedOrdersFixed({});

  // Fetch ALL same-chain orders (no filtering by address) - Fixed version with static hooks
  const { orders: sameChainOrders, isLoading: isSameChainLoading } = useAllSameChainOrdersFixed();

  // Fetch SUI orders
  const targetChainNum = typeof targetChainId === 'number' ? targetChainId : undefined;
  const { orders: suiOrders, isLoading: isSuiLoading, refetch: refetchSuiOrders } = useSuiOrders(targetChainNum);

  const isLoading = isCrossChainLoading || isSameChainLoading || isSuiLoading;

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
    console.log('  Raw SUI orders count:', suiOrders.length);
    console.log('  Raw SUI orders:', suiOrders);

    // Convert SUI orders to UnifiedOrder format
    const convertedSuiOrders: UnifiedOrder[] = suiOrders.map((suiOrder) => {
      // Parse token symbols - handles both SUI addresses and EVM addresses
      const parseTokenSymbol = (tokenAddr: string, chainId: number | string): string => {
        // SUI-style address: "0x2::sui::SUI" or "0xPACKAGE::module::TOKEN"
        if (tokenAddr.includes('::')) {
          const parts = tokenAddr.split('::');
          if (parts.length === 3) {
            return parts[2].toUpperCase(); // Return last part (e.g., "SUI")
          }
        }

        // EVM-style address: lookup in token registry
        const token = getTokenByAddress(chainId, tokenAddr);
        if (token) {
          return token.symbol;
        }

        console.warn('⚠️ Unknown token:', tokenAddr, 'on chain', chainId);
        return 'UNKNOWN';
      };

      // CRITICAL: targetChainId === 0 means same-chain (SUI → SUI)
      const isSameChainSui = suiOrder.targetChainId === 0;
      const actualTargetChainId = isSameChainSui ? 'sui:testnet' : suiOrder.targetChainId;

      const sellSymbol = parseTokenSymbol(suiOrder.sellToken, 'sui:testnet'); // Sell is on SUI
      const buySymbol = parseTokenSymbol(suiOrder.buyToken, actualTargetChainId); // Buy is on target chain

      // CRITICAL: SUI cross-chain orders store amounts with 9 decimals precision
      // (to avoid u64 overflow - max value limits 18 decimal tokens to ~18 units)
      // All amounts are normalized to 9 decimals regardless of native token decimals
      const CROSS_CHAIN_DECIMALS = 9;

      return {
        // Required CrossChainOrder fields
        id: BigInt(suiOrder.id),
        creator: suiOrder.creator as `0x${string}`,
        sellToken: suiOrder.sellToken as `0x${string}`,
        sellAmount: suiOrder.sellAmount,
        sourceChainId: BigInt('sui:testnet'.length), // Placeholder - will use sourceChainIdNum
        buyToken: suiOrder.buyToken as `0x${string}`,
        buyAmount: suiOrder.buyAmount,
        targetChainId: BigInt(typeof actualTargetChainId === 'string' ? 0 : actualTargetChainId),
        targetAddress: suiOrder.creator as `0x${string}`,
        minTimelock: BigInt(3600),
        expiresAt: suiOrder.expiresAt,
        status: suiOrder.status as any,
        matchedBy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        htlcSwapId: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,

        // UnifiedOrder fields
        price: Number(suiOrder.buyAmount) / Number(suiOrder.sellAmount),
        inversePrice: Number(suiOrder.sellAmount) / Number(suiOrder.buyAmount),
        sellSymbol,
        buySymbol,
        // Use 9 decimals for all cross-chain orders (u64 limitation workaround)
        formattedSellAmount: (Number(suiOrder.sellAmount) / Math.pow(10, CROSS_CHAIN_DECIMALS)).toString(),
        formattedBuyAmount: (Number(suiOrder.buyAmount) / Math.pow(10, CROSS_CHAIN_DECIMALS)).toString(),
        sourceChainIdNum: 'sui:testnet', // Use string chainId for SUI
        targetChainIdNum: actualTargetChainId, // 'sui:testnet' for same-chain, number for cross-chain
      };
    });

    let combined = [...crossChainOrders, ...sameChainOrders, ...convertedSuiOrders];
    console.log('  Initial combined orders (including SUI):', combined.length);

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

    // Filter by exact blockchain match (support both number and string chainIds)
    if (sourceChainId !== undefined && targetChainId !== undefined) {
      const isSameChain = sourceChainId === targetChainId;
      const before = combined.length;

      if (isSameChain) {
        // Same-chain mode: only show orders from this specific chain
        combined = combined.filter((o) => {
          // Compare as strings to handle both number and string chainIds
          const sourceMatch = String(o.sourceChainIdNum) === String(sourceChainId);
          const targetMatch = String(o.targetChainIdNum) === String(targetChainId);
          return sourceMatch && targetMatch;
        });
      } else {
        // Cross-chain mode: only show orders matching exact source->target chain pair
        combined = combined.filter((o) => {
          const sourceMatch = String(o.sourceChainIdNum) === String(sourceChainId);
          const targetMatch = String(o.targetChainIdNum) === String(targetChainId);
          return sourceMatch && targetMatch;
        });
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
  }, [crossChainOrders, sameChainOrders, suiOrders, sourceTokenSymbol, targetTokenSymbol, sourceChainId, targetChainId]);

  return {
    orders: allOrders,
    isLoading,
    crossChainCount: crossChainOrders.length,
    sameChainCount: sameChainOrders.length,
    suiCount: suiOrders.length,
    refetchSuiOrders, // Expose SUI refetch function
  };
}
