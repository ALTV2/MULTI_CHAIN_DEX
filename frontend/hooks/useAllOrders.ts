'use client';

import { useMemo } from 'react';
import { useAllUnifiedOrdersFixed, type UnifiedOrder } from './useAllUnifiedOrdersFixed';
import { useAllSameChainOrdersFixed } from './useAllSameChainOrdersFixed';
import { useSuiOrders } from './useSuiOrders';
import { useSuiSameChainOrders } from './useSuiSameChainOrders';
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

  // Fetch ALL SUI cross-chain orders (no pre-filter by target chain — let client-side filter handle it)
  const { orders: suiOrders, isLoading: isSuiLoading, refetch: refetchSuiOrders } = useSuiOrders();

  // Fetch SUI same-chain orders (SUI → SUI)
  const { orders: suiSameChainOrders, isLoading: isSuiSameChainLoading } = useSuiSameChainOrders();

  const isLoading = isCrossChainLoading || isSameChainLoading || isSuiLoading || isSuiSameChainLoading;

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
        // Always check token registry first — covers SUI Move types AND EVM addresses
        const token = getTokenByAddress(chainId, tokenAddr);
        if (token) {
          return token.symbol;
        }

        // Fallback: SUI-style type string "0xPACKAGE::module::TYPE" not in registry
        if (tokenAddr.includes('::')) {
          const parts = tokenAddr.split('::');
          if (parts.length === 3) {
            return parts[2].toUpperCase();
          }
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
        targetAddress: suiOrder.targetAddress as `0x${string}`,
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

    // Convert SUI same-chain orders to UnifiedOrder format
    const convertedSuiSameChain: UnifiedOrder[] = suiSameChainOrders
      .filter((o) => o.status === 'Active')
      .map((o) => {
        const sellSymbol = getTokenByAddress('sui:testnet', o.pairConfig.coinAType)?.symbol
          || o.pairConfig.coinAType.split('::').pop() || 'UNKNOWN';
        const buySymbol = getTokenByAddress('sui:testnet', o.pairConfig.coinBType)?.symbol
          || o.pairConfig.coinBType.split('::').pop() || 'UNKNOWN';
        const SUI_DECIMALS = 9;
        return {
          id: BigInt(o.orderId),
          creator: o.creator as `0x${string}`,
          sellToken: o.pairConfig.coinAType as `0x${string}`,
          sellAmount: o.sellAmount,
          sourceChainId: BigInt(0),
          buyToken: o.pairConfig.coinBType as `0x${string}`,
          buyAmount: o.buyAmount,
          targetChainId: BigInt(0),
          targetAddress: o.creator as `0x${string}`,
          minTimelock: BigInt(0),
          expiresAt: BigInt(0),
          status: 'Active' as any,
          matchedBy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          htlcSwapId: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          price: Number(o.buyAmount) / Number(o.sellAmount),
          inversePrice: Number(o.sellAmount) / Number(o.buyAmount),
          sellSymbol,
          buySymbol,
          formattedSellAmount: (Number(o.sellAmount) / Math.pow(10, SUI_DECIMALS)).toString(),
          formattedBuyAmount: (Number(o.buyAmount) / Math.pow(10, SUI_DECIMALS)).toString(),
          sourceChainIdNum: 'sui:testnet',
          targetChainIdNum: 'sui:testnet',
          suiSameChainMeta: {
            orderObjectId: o.orderObjectId,
            coinAType: o.pairConfig.coinAType,
            coinBType: o.pairConfig.coinBType,
            pairId: o.pairConfig.pairId,
          },
        };
      });

    let combined = [...crossChainOrders, ...sameChainOrders, ...convertedSuiOrders, ...convertedSuiSameChain];
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
  }, [crossChainOrders, sameChainOrders, suiOrders, suiSameChainOrders, sourceTokenSymbol, targetTokenSymbol, sourceChainId, targetChainId]);

  return {
    orders: allOrders,
    isLoading,
    crossChainCount: crossChainOrders.length,
    sameChainCount: sameChainOrders.length,
    suiCount: suiOrders.length,
    refetchSuiOrders, // Expose SUI refetch function
  };
}
