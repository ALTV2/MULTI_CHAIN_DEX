'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress, chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';

export type CrossChainOrderStatus = 'Active' | 'Matched' | 'Completed' | 'Cancelled' | 'Expired';

export interface CrossChainOrder {
  id: bigint;
  creator: `0x${string}`;
  sellToken: `0x${string}`;
  sellAmount: bigint;
  sourceChainId: bigint;
  buyToken: `0x${string}`;
  buyAmount: bigint;
  targetChainId: bigint;
  targetAddress: `0x${string}`;
  minTimelock: bigint;
  expiresAt: bigint;
  status: CrossChainOrderStatus;
  matchedBy: `0x${string}`;
  htlcSwapId: `0x${string}`;
}

const STATUS_MAP: Record<number, CrossChainOrderStatus> = {
  0: 'Active',
  1: 'Matched',
  2: 'Completed',
  3: 'Cancelled',
  4: 'Expired',
};

function mapOrder(data: any): CrossChainOrder {
  return {
    id: data.id,
    creator: data.creator,
    sellToken: data.sellToken,
    sellAmount: data.sellAmount,
    sourceChainId: data.sourceChainId,
    buyToken: data.buyToken,
    buyAmount: data.buyAmount,
    targetChainId: data.targetChainId,
    targetAddress: data.targetAddress,
    minTimelock: data.minTimelock,
    expiresAt: data.expiresAt,
    status: STATUS_MAP[data.status] || 'Active',
    matchedBy: data.matchedBy,
    htlcSwapId: data.htlcSwapId,
  };
}

export function useCrossChainOrdersForTarget(sourceChainId: number, targetChainId: number) {
  const ccobAddress = getContractAddress(sourceChainId, 'crossChainOrderBook') as `0x${string}`;

  const query = useQuery({
    queryKey: ['crossChainOrders', sourceChainId, targetChainId],
    networkMode: 'offlineFirst', // Don't cancel based on network status
    queryFn: async (): Promise<any[]> => {
      const client = getPublicClient(sourceChainId);

      console.log(`🔍 Fetching cross-chain orders: ${sourceChainId} → ${targetChainId}`);
      const data = await client.readContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'getActiveOrdersForTargetChain',
        args: [BigInt(targetChainId)],
      }) as any[];

      console.log(`📦 Raw orders fetched (${sourceChainId} → ${targetChainId}):`, data?.length || 0, data);
      return data || [];
    },
    enabled: !!ccobAddress,
    refetchOnMount: true, // Refetch on mount to get latest orders
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: false, // Don't refetch on network reconnect
    refetchInterval: 15000, // Auto-refresh every 15 seconds
    gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes even when unmounted
    staleTime: 10000, // Consider data stale after 10s
  });

  const orders = useMemo<CrossChainOrder[]>(() => {
    if (!query.data) return [];
    const mapped = query.data.map(mapOrder);
    console.log(`✅ Mapped cross-chain orders:`, mapped.length, mapped);
    return mapped;
  }, [query.data]);

  return {
    orders,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useMyeCrossChainOrders(chainId: number) {
  const { address } = useAccount();
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook') as `0x${string}`;

  const query = useQuery({
    queryKey: ['myeCrossChainOrders', chainId, address],
    networkMode: 'offlineFirst', // Don't cancel based on network status
    queryFn: async (): Promise<any[]> => {
      if (!address) return [];

      const client = getPublicClient(chainId);

      const data = await client.readContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'getOrdersByCreator',
        args: [address],
      }) as any[];

      return data || [];
    },
    enabled: !!address && !!ccobAddress,
    refetchOnMount: true, // Always refetch on mount to get latest orders
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on network reconnect
    gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes even when unmounted
    staleTime: 10000, // Consider data stale after 10s
  });

  const orders = useMemo<CrossChainOrder[]>(() => {
    if (!query.data) return [];
    const mapped = query.data.map(mapOrder);
    console.log(`✅ Mapped cross-chain orders:`, mapped.length, mapped);
    return mapped;
  }, [query.data]);

  return {
    orders,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateCrossChainOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook') as `0x${string}`;
  const queryClient = useQueryClient();

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Invalidate order caches when transaction is confirmed
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Cross-chain order created, invalidating all order caches');
      // Invalidate all cross-chain order queries
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myeCrossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
    }
  }, [isSuccess, hash, queryClient]);

  const createOrder = useCallback(
    async (params: {
      sellToken: `0x${string}`;
      sellAmount: bigint;
      buyToken: `0x${string}`;
      buyAmount: bigint;
      targetChainId: number;
      targetAddress: `0x${string}`;
      minTimelock: bigint;
      expiresAt: bigint;
    }) => {
      // Polygon requires higher gas prices
      const isPolygon = chainId === 137 || chainId === 80002;
      const gasConfig = isPolygon
        ? {
            gas: 500000n,
            maxFeePerGas: 50000000000n, // 50 Gwei
            maxPriorityFeePerGas: 30000000000n, // 30 Gwei
          }
        : {
            gas: 500000n,
          };

      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'createOrder',
        args: [
          params.sellToken,
          params.sellAmount,
          params.buyToken,
          params.buyAmount,
          BigInt(params.targetChainId),
          params.targetAddress,
          params.minTimelock,
          params.expiresAt,
        ],
        ...gasConfig,
      });
    },
    [writeContract, ccobAddress, chainId]
  );

  return {
    createOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useMatchCrossChainOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook') as `0x${string}`;
  const queryClient = useQueryClient();

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Invalidate order caches when transaction is confirmed
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Cross-chain order matched, invalidating all order caches');
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myeCrossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
    }
  }, [isSuccess, hash, queryClient]);

  const matchOrder = useCallback(
    async (orderId: bigint, htlcSwapId: `0x${string}`) => {
      // Polygon requires higher gas prices
      const isPolygon = chainId === 137 || chainId === 80002;
      const gasConfig = isPolygon
        ? {
            gas: 500000n,
            maxFeePerGas: 50000000000n, // 50 Gwei
            maxPriorityFeePerGas: 30000000000n, // 30 Gwei
          }
        : {
            gas: 500000n,
          };

      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'matchOrder',
        args: [orderId, htlcSwapId],
        ...gasConfig,
      });
    },
    [writeContract, ccobAddress, chainId]
  );

  return {
    matchOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useCancelCrossChainOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook') as `0x${string}`;
  const queryClient = useQueryClient();

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Invalidate order caches when transaction is confirmed
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Cross-chain order cancelled, invalidating all order caches');
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myeCrossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
    }
  }, [isSuccess, hash, queryClient]);

  const cancelOrder = useCallback(
    async (orderId: bigint) => {
      console.log('🗑️ useCancelCrossChainOrder: Cancelling order', {
        orderId: orderId.toString(),
        chainId,
        ccobAddress,
      });

      // Polygon requires higher gas prices
      const isPolygon = chainId === 137 || chainId === 80002;
      const gasConfig = isPolygon
        ? {
            gas: 300000n,
            maxFeePerGas: 50000000000n, // 50 Gwei
            maxPriorityFeePerGas: 30000000000n, // 30 Gwei
          }
        : {
            gas: 300000n,
          };

      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'cancelOrder',
        args: [orderId],
        ...gasConfig,
      });
    },
    [writeContract, ccobAddress, chainId]
  );

  return {
    cancelOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useReactivateCrossChainOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook') as `0x${string}`;
  const queryClient = useQueryClient();

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Invalidate order caches when transaction is confirmed
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Cross-chain order reactivated, invalidating all order caches');
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myeCrossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
    }
  }, [isSuccess, hash, queryClient]);

  const reactivateOrder = useCallback(
    async (orderId: bigint) => {
      console.log('🔄 useReactivateCrossChainOrder: Reactivating matched order', {
        orderId: orderId.toString(),
        chainId,
        ccobAddress,
      });

      // Polygon requires higher gas prices
      const isPolygon = chainId === 137 || chainId === 80002;
      const gasConfig = isPolygon
        ? {
            gas: 300000n,
            maxFeePerGas: 50000000000n, // 50 Gwei
            maxPriorityFeePerGas: 30000000000n, // 30 Gwei
          }
        : {
            gas: 300000n,
          };

      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'reactivateOrder',
        args: [orderId],
        ...gasConfig,
      });
    },
    [writeContract, ccobAddress, chainId]
  );

  return {
    reactivateOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useGetChainName(chainId: number): string {
  const config = chainConfig[chainId as SupportedChainId];
  return config?.shortName || `Chain ${chainId}`;
}
