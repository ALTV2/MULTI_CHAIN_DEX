'use client';

import { useQuery } from '@tanstack/react-query';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { ORDER_STATUS, ORDER_BOOK_STALE_MS } from '@/lib/constants/swap';
import { OrderStatus } from '@/types/order';
import type { Order } from '@/types/order';

/**
 * Fetch orders from a specific chain's OrderBook contract
 */
export function useOrderBookForChain(chainId: number) {
  const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

  const query = useQuery({
    queryKey: ['orderBook', chainId],
    networkMode: 'offlineFirst', // Don't cancel based on network status
    queryFn: async (): Promise<Order[]> => {
      const client = getPublicClient(chainId);

      const orderCounter = await client.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      }) as bigint;

      if (orderCounter === 0n) return [];

      const orders: Order[] = [];

      // Fetch all orders
      for (let i = 1n; i <= orderCounter; i++) {
        try {
          const order = await client.readContract({
            address: orderBookAddress,
            abi: orderBookABI,
            functionName: 'getOrder',
            args: [i],
          }) as any;

          // Only include active orders
          if (order.status === ORDER_STATUS.ACTIVE) {
            orders.push({
              id: order.id,
              creator: order.creator as `0x${string}`,
              tokenToSell: order.tokenToSell as `0x${string}`,
              tokenToBuy: order.tokenToBuy as `0x${string}`,
              sellAmount: order.sellAmount,
              buyAmount: order.buyAmount,
              status: OrderStatus.Active,
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch order ${i} on chain ${chainId}:`, err);
        }
      }

      return orders;
    },
    refetchInterval: 15000, // Auto-refresh every 15 seconds (was 30s)
    refetchOnMount: true, // Refetch on mount to get latest orders
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: false, // Don't refetch on network reconnect
    staleTime: ORDER_BOOK_STALE_MS,
    gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes even when unmounted
    enabled: true, // Always enabled, don't cancel based on wallet chain
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
