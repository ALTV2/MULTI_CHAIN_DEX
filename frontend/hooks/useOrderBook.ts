'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usePublicClient,
  useChainId,
  useWatchContractEvent,
} from 'wagmi';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import type { Order, OrderDisplay, OrderStatus } from '@/types/order';
import { formatUnits } from 'viem';

export function useOrderBook() {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const orderBookAddress = getContractAddress(chainId, 'orderBook');

  const query = useQuery({
    queryKey: ['orderBook', chainId],
    queryFn: async (): Promise<OrderDisplay[]> => {
      if (!publicClient) return [];

      const orderCounter = await publicClient.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      });

      if (orderCounter === 0n) return [];

      const orders: OrderDisplay[] = [];

      // Fetch orders in batches for better performance
      const batchSize = 10;
      for (let i = 1n; i <= orderCounter; i += BigInt(batchSize)) {
        const batch = [];
        for (let j = i; j < i + BigInt(batchSize) && j <= orderCounter; j++) {
          batch.push(
            publicClient.readContract({
              address: orderBookAddress,
              abi: orderBookABI,
              functionName: 'getOrder',
              args: [j],
            })
          );
        }

        const results = await Promise.all(batch);

        for (const order of results) {
          // Only include active orders
          if (order.status === 0) {
            const sellToken = getTokenByAddress(chainId, order.tokenToSell);
            const buyToken = getTokenByAddress(chainId, order.tokenToBuy);

            if (sellToken && buyToken) {
              const sellAmountNum = parseFloat(
                formatUnits(order.sellAmount, sellToken.decimals)
              );
              const buyAmountNum = parseFloat(
                formatUnits(order.buyAmount, buyToken.decimals)
              );

              orders.push({
                ...order,
                sellToken,
                buyToken,
                rate: sellAmountNum > 0 ? buyAmountNum / sellAmountNum : 0,
                inverseRate: buyAmountNum > 0 ? sellAmountNum / buyAmountNum : 0,
              });
            }
          }
        }
      }

      // Sort by newest first (highest ID)
      return orders.sort((a, b) => Number(b.id - a.id));
    },
    refetchInterval: 30000, // Refetch every 30s
    staleTime: 10000,
  });

  // Watch for new orders
  useWatchContractEvent({
    address: orderBookAddress,
    abi: orderBookABI,
    eventName: 'OrderCreated',
    onLogs: () => {
      queryClient.invalidateQueries({ queryKey: ['orderBook', chainId] });
    },
  });

  // Watch for cancelled orders
  useWatchContractEvent({
    address: orderBookAddress,
    abi: orderBookABI,
    eventName: 'OrderCancelled',
    onLogs: () => {
      queryClient.invalidateQueries({ queryKey: ['orderBook', chainId] });
    },
  });

  // Watch for executed orders
  useWatchContractEvent({
    address: orderBookAddress,
    abi: orderBookABI,
    eventName: 'OrderExecuted',
    onLogs: () => {
      queryClient.invalidateQueries({ queryKey: ['orderBook', chainId] });
    },
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
