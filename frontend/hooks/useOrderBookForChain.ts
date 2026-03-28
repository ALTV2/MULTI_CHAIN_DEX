'use client';

import { useQuery } from '@tanstack/react-query';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { ORDER_STATUS, ORDER_BOOK_STALE_MS } from '@/lib/constants/swap';
import { OrderStatus } from '@/types/order';
import type { Order } from '@/types/order';

/**
 * Fetch orders from a specific chain's OrderBook contract.
 * Lazy by default — call refetch() to load.
 */
export function useOrderBookForChain(chainId: number) {
  const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

  const query = useQuery({
    queryKey: ['orderBook', chainId],
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<Order[]> => {
      const client = getPublicClient(chainId);

      const orderCounter = await client.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      }) as bigint;

      if (orderCounter === 0n) return [];

      const orders: Order[] = [];

      for (let i = 1n; i <= orderCounter; i++) {
        try {
          const order = await client.readContract({
            address: orderBookAddress,
            abi: orderBookABI,
            functionName: 'getOrder',
            args: [i],
          }) as any;

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
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: ORDER_BOOK_STALE_MS,
    gcTime: 5 * 60 * 1000,
    enabled: false, // Lazy — only fetch on manual refetch()
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading || query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
