'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress, getSupportedChainIds } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { ORDER_STATUS, ZERO_ADDRESS } from '@/lib/constants/swap';
import type { ActiveSwap, SwapPhase } from '@/types/swap';
import { useActiveSwaps } from './useActiveSwaps';
import { useSuiUserOrders } from './useSuiUserOrders';
import { useMyeCrossChainOrders } from './useCrossChainOrders';
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
  // Note: Object.keys() always returns strings, so we filter by excluding SUI chains
  const chainIds = allChainIds
    .filter((id) => !String(id).startsWith('sui:'))
    .map((id) => Number(id));
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

  // Fetch cross-chain orders from both EVM chains via React Query (with retry logic)
  const { orders: sepoliaOrders, isLoading: isSepoliaLoading, refetch: refetchSepolia } = useMyeCrossChainOrders(sepolia.id);
  const { orders: polygonOrders, isLoading: isPolygonLoading, refetch: refetchPolygon } = useMyeCrossChainOrders(polygonAmoy.id);

  const fetchSameChain = useCallback(async () => {
    if (!address) {
      setSameChainOrders([]);
      return;
    }

    setIsSameChainLoading(true);
    try {
      const sameChain = await fetchUserSameChainOrders(address);
      setSameChainOrders(sameChain);
    } catch (err) {
      console.error('Failed to fetch on-chain orders:', err);
    } finally {
      setIsSameChainLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchSameChain();
  }, [fetchSameChain, lastRefresh]);

  const refetch = useCallback(() => {
    refetchCrossChain();
    refetchSepolia();
    refetchPolygon();
    setLastRefresh(Date.now());
  }, [refetchCrossChain, refetchSepolia, refetchPolygon]);

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
        phase = 'creator_htlc_created'; // Matched order moves to HTLC phase
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

  // Convert directly-fetched cross-chain orders into ActiveSwap format.
  // Only include orders NOT already present in crossChainSwaps (from localStorage/scan),
  // so we don't show duplicates. This catches orders that weren't saved to localStorage.
  const crossChainDirectAsSwaps = useMemo<ActiveSwap[]>(() => {
    const localKeys = new Set(
      crossChainSwaps.map((s) => `${s.meta.sourceChainId}-${s.meta.orderId}`)
    );

    console.log('[DEBUG useAllUserOrders] crossChainSwaps (localStorage):', crossChainSwaps.length, crossChainSwaps.map(s => `${s.meta.sourceChainId}-${s.meta.orderId} phase=${s.phase} creator=${s.meta.creator}`));
    console.log('[DEBUG useAllUserOrders] sepoliaOrders (React Query):', sepoliaOrders.length, sepoliaOrders.map(o => `id=${o.id} status=${o.status} creator=${o.creator}`));
    console.log('[DEBUG useAllUserOrders] polygonOrders (React Query):', polygonOrders.length, polygonOrders.map(o => `id=${o.id} status=${o.status} creator=${o.creator}`));

    const combined = [
      ...sepoliaOrders.map((o) => ({ order: o, chainId: sepolia.id })),
      ...polygonOrders.map((o) => ({ order: o, chainId: polygonAmoy.id })),
    ];

    const filtered = combined.filter(({ order, chainId }) => !localKeys.has(`${chainId}-${order.id.toString()}`));
    console.log('[DEBUG useAllUserOrders] crossChainDirectAsSwaps after dedup:', filtered.length, filtered.map(({order, chainId}) => `${chainId}-${order.id} status=${order.status}`));

    return filtered
      .map(({ order, chainId }) => {
        const hasMatch = order.matchedBy !== ZERO_ADDRESS;
        return {
          meta: {
            orderId: order.id.toString(),
            role: 'creator' as const,
            sourceChainId: chainId,
            targetChainId: Number(order.targetChainId),
            hashlock: '',
            sellToken: order.sellToken,
            sellAmount: order.sellAmount.toString(),
            buyToken: order.buyToken,
            buyAmount: order.buyAmount.toString(),
            creator: order.creator,
            matcher: hasMatch ? order.matchedBy : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          phase: (hasMatch ? 'order_matched' : 'order_created') as SwapPhase,
          orderStatus: order.status, // Already a readable string: 'Active', 'Matched', etc.
          expiresAt: order.expiresAt,
        };
      });
  }, [crossChainSwaps, sepoliaOrders, polygonOrders]);

  // Merge cross-chain, same-chain, and SUI orders
  const allSwaps = useMemo(() => {
    const merged = [...crossChainSwaps, ...crossChainDirectAsSwaps, ...sameChainAsSwaps, ...suiOrdersAsSwaps];
    console.log('[DEBUG useAllUserOrders] allSwaps:', merged.length, merged.map(s => `${s.meta.sourceChainId}-${s.meta.orderId} phase=${s.phase} status=${s.orderStatus} creator=${s.meta.creator}`));
    return merged;
  }, [crossChainSwaps, crossChainDirectAsSwaps, sameChainAsSwaps, suiOrdersAsSwaps]);

  const activeSwaps = useMemo(
    () => {
      const now = BigInt(Math.floor(Date.now() / 1000));

      const result = allSwaps.filter((s) => {
        // Exclude completed/refunded/refundable phases
        if (['completed', 'refunded', 'refundable'].includes(s.phase)) return false;

        // Exclude cancelled, expired, or completed orders at the blockchain level
        if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) return false;

        // For cross-chain orders with expiresAt, exclude if time has passed
        if (s.expiresAt && s.expiresAt <= now) return false;

        return true;
      });
      console.log('[DEBUG useAllUserOrders] activeSwaps:', result.length, result.map(s => `${s.meta.sourceChainId}-${s.meta.orderId} phase=${s.phase} status=${s.orderStatus}`));
      return result;
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

  const isLoading = isCrossChainLoading || isSameChainLoading || isSuiLoading || isSepoliaLoading || isPolygonLoading;

  return {
    swaps: allSwaps,
    activeSwaps,
    historySwaps,
    isLoading,
    refetch,
    // Separate counts for debugging/stats
    crossChainCount: crossChainSwaps.length + sepoliaOrders.length + polygonOrders.length,
    sameChainCount: sameChainOrders.length,
    suiCount: suiOrders.length,
  };
}
