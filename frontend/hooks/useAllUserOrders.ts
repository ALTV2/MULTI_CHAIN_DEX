'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatUnits } from 'viem';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress, getSupportedChainIds } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { ORDER_STATUS } from '@/lib/constants/swap';
import type { ActiveSwap, SwapPhase } from '@/types/swap';
import { useActiveSwaps } from './useActiveSwaps';
import { useSuiUserOrders } from './useSuiUserOrders';
import type { SuiOrder } from './useSuiOrders';

interface SameChainOrder {
  id: bigint;
  chainId: number;
  creator: string;
  tokenToSell: string;
  tokenToBuy: string;
  sellAmount: bigint;
  buyAmount: bigint;
  status: number;
  type: 'same-chain';
}

/**
 * Scan all supported chains for same-chain orders where user is the creator
 */
async function fetchUserSameChainOrders(walletAddress: string): Promise<SameChainOrder[]> {
  const allChainIds = getSupportedChainIds();
  // Filter for EVM chains only (same-chain orders use EVM contracts)
  const chainIds = allChainIds.filter((id) => typeof id === 'number') as number[];
  const allOrders: SameChainOrder[] = [];

  for (const chainId of chainIds) {
    try {
      const client = getPublicClient(chainId);
      const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

      // Get total number of orders
      const orderCounter = await client.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      }) as bigint;

      if (orderCounter === 0n) continue;

      // Fetch all orders and filter by creator
      const lowerWallet = walletAddress.toLowerCase();

      for (let i = 1n; i <= orderCounter; i++) {
        try {
          const order = await client.readContract({
            address: orderBookAddress,
            abi: orderBookABI,
            functionName: 'getOrder',
            args: [i],
          }) as any;

          // Only include orders created by this user
          if (order.creator.toLowerCase() === lowerWallet) {
            allOrders.push({
              id: order.id,
              chainId,
              creator: order.creator,
              tokenToSell: order.tokenToSell,
              tokenToBuy: order.tokenToBuy,
              sellAmount: order.sellAmount,
              buyAmount: order.buyAmount,
              status: order.status,
              type: 'same-chain',
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch order ${i} on chain ${chainId}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed to scan same-chain orders on chain ${chainId}:`, err);
    }
  }

  return allOrders;
}

/**
 * Unified hook that combines both cross-chain and same-chain orders (EVM + SUI)
 */
export function useAllUserOrders() {
  const { address } = useAccount(); // EVM wallet
  const suiAccount = useCurrentAccount(); // SUI wallet
  const { swaps: crossChainSwaps, isLoading: isCrossChainLoading, refetch: refetchCrossChain } = useActiveSwaps();

  const [sameChainOrders, setSameChainOrders] = useState<SameChainOrder[]>([]);
  const [isSameChainLoading, setIsSameChainLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  // Fetch SUI orders for current SUI wallet
  const { orders: suiOrders, isLoading: isSuiLoading } = useSuiUserOrders();

  const fetchSameChain = useCallback(async () => {
    if (!address) {
      setSameChainOrders([]);
      return;
    }

    setIsSameChainLoading(true);
    try {
      const orders = await fetchUserSameChainOrders(address);
      setSameChainOrders(orders);
    } catch (err) {
      console.error('Failed to fetch same-chain orders:', err);
    } finally {
      setIsSameChainLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchSameChain();
  }, [fetchSameChain, lastRefresh]);

  const refetch = useCallback(() => {
    refetchCrossChain();
    setLastRefresh(Date.now());
  }, [refetchCrossChain]);

  // Convert same-chain orders to ActiveSwap format for unified display
  const sameChainAsSwaps = useMemo<ActiveSwap[]>(() => {
    return sameChainOrders.map((order) => {
      let phase: SwapPhase = 'order_created';

      if (order.status === ORDER_STATUS.COMPLETED) {
        phase = 'completed';
      } else if (order.status === ORDER_STATUS.CANCELLED) {
        phase = 'refunded';
      }

      return {
        meta: {
          orderId: order.id.toString(),
          role: 'creator' as const,
          sourceChainId: order.chainId,
          targetChainId: order.chainId, // Same chain
          hashlock: '',
          sellToken: order.tokenToSell,
          sellAmount: order.sellAmount.toString(),
          buyToken: order.tokenToBuy,
          buyAmount: order.buyAmount.toString(),
          creator: order.creator,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        phase,
        orderStatus: order.status === ORDER_STATUS.ACTIVE ? 'Active' : order.status === ORDER_STATUS.COMPLETED ? 'Completed' : 'Cancelled',
      };
    });
  }, [sameChainOrders]);

  // Convert SUI orders to ActiveSwap format
  const suiOrdersAsSwaps = useMemo<ActiveSwap[]>(() => {
    return suiOrders.map((order) => {
      let phase: SwapPhase = 'order_created';
      let orderStatus = 'Active';

      if (order.status === 'Completed') {
        phase = 'completed';
        orderStatus = 'Completed';
      } else if (order.status === 'Cancelled') {
        phase = 'refunded';
        orderStatus = 'Cancelled';
      } else if (order.status === 'Matched') {
        phase = 'htlc_created'; // Matched order moves to HTLC phase
        orderStatus = 'Matched';
      }

      const isCrossChain = order.targetChainId !== 0; // 0 = same-chain SUI, otherwise cross-chain

      return {
        meta: {
          orderId: `sui-${order.id}`,
          role: 'creator' as const,
          sourceChainId: 'sui:testnet',
          targetChainId: isCrossChain ? order.targetChainId : 'sui:testnet',
          hashlock: '',
          sellToken: order.sellToken,
          sellAmount: order.sellAmount.toString(),
          buyToken: order.buyToken,
          buyAmount: order.buyAmount.toString(),
          creator: order.creator,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        phase,
        orderStatus,
        expiresAt: order.expiresAt,
      };
    });
  }, [suiOrders]);

  // Merge cross-chain, same-chain, and SUI orders
  const allSwaps = useMemo(() => {
    console.log('[useAllUserOrders] Merging orders:', {
      crossChain: crossChainSwaps.length,
      sameChain: sameChainAsSwaps.length,
      sui: suiOrdersAsSwaps.length,
    });
    return [...crossChainSwaps, ...sameChainAsSwaps, ...suiOrdersAsSwaps];
  }, [crossChainSwaps, sameChainAsSwaps, suiOrdersAsSwaps]);

  const activeSwaps = useMemo(
    () => {
      console.log('[useAllUserOrders] Filtering swaps, total:', allSwaps.length);
      const now = BigInt(Math.floor(Date.now() / 1000));

      return allSwaps.filter((s) => {
        // Exclude completed/refunded/refundable phases
        if (['completed', 'refunded', 'refundable'].includes(s.phase)) {
          console.log(`  → [useAllUserOrders] Excluding swap ${s.meta.orderId}: phase=${s.phase}`);
          return false;
        }

        // Exclude cancelled, expired, or completed orders at the blockchain level
        if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) {
          console.log(`  → [useAllUserOrders] Excluding swap ${s.meta.orderId}: orderStatus=${s.orderStatus}`);
          return false;
        }

        // ⚠️ IMPORTANT: Check if order has expired locally (time-based check)
        // For cross-chain orders with expiresAt, exclude if time has passed
        if (s.expiresAt && s.expiresAt <= now) {
          console.log(`  → [useAllUserOrders] Excluding swap ${s.meta.orderId}: expired locally (expiresAt=${s.expiresAt}, now=${now})`);
          return false;
        }

        console.log(`  ✓ [useAllUserOrders] Including swap ${s.meta.orderId}: phase=${s.phase}, orderStatus=${s.orderStatus || 'undefined'}`);
        return true;
      });
    },
    [allSwaps]
  );

  const historySwaps = useMemo(
    () => {
      const now = BigInt(Math.floor(Date.now() / 1000));

      return allSwaps.filter((s) => {
        // Include completed/refunded/refundable phases
        if (['completed', 'refunded', 'refundable'].includes(s.phase)) return true;

        // Include cancelled, expired, or completed orders
        if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) {
          return true;
        }

        // Include locally expired orders
        if (s.expiresAt && s.expiresAt <= now) {
          return true;
        }

        return false;
      });
    },
    [allSwaps]
  );

  const isLoading = isCrossChainLoading || isSameChainLoading || isSuiLoading;

  return {
    swaps: allSwaps,
    activeSwaps,
    historySwaps,
    isLoading,
    refetch,
    // Separate counts for debugging/stats
    crossChainCount: crossChainSwaps.length,
    sameChainCount: sameChainOrders.length,
    suiCount: suiOrders.length,
  };
}
