'use client';

import { useQuery } from '@tanstack/react-query';
import {
  useAccount,
  usePublicClient,
  useChainId,
} from 'wagmi';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import type { OrderDisplay } from '@/types/order';
import { formatUnits } from 'viem';

export function useUserOrders() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

  const query = useQuery({
    queryKey: ['userOrders', chainId, userAddress],
    queryFn: async (): Promise<OrderDisplay[]> => {
      if (!publicClient || !userAddress) return [];

      const orderCounter = await publicClient.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      });

      if (orderCounter === 0n) return [];

      const orders: OrderDisplay[] = [];

      // Fetch orders in batches
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
          // Only include orders created by this user
          if (order.creator.toLowerCase() === userAddress.toLowerCase()) {
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

      // Sort by newest first
      return orders.sort((a, b) => Number(b.id - a.id));
    },
    enabled: false, // Lazy — only fetch on manual refetch()
    staleTime: 30_000,
  });

  // Event watchers removed — use manual refresh to reduce RPC load

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
