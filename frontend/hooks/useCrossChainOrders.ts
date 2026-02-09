'use client';

import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useCallback, useMemo } from 'react';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress, chainConfig, SupportedChainId } from '@/lib/contracts/addresses';

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
  const ccobAddress = getContractAddress(sourceChainId, 'crossChainOrderBook');

  const { data, isLoading, error, refetch } = useReadContract({
    address: ccobAddress,
    abi: CROSS_CHAIN_ORDER_BOOK_ABI,
    functionName: 'getActiveOrdersForTargetChain',
    args: [BigInt(targetChainId)],
    chainId: sourceChainId,
    query: {
      enabled: !!ccobAddress,
    },
  });

  const orders = useMemo<CrossChainOrder[]>(() => {
    if (!data) return [];
    return (data as any[]).map(mapOrder);
  }, [data]);

  return {
    orders,
    isLoading,
    error,
    refetch,
  };
}

export function useMyeCrossChainOrders(chainId: number) {
  const { address } = useAccount();
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook');

  const { data, isLoading, error, refetch } = useReadContract({
    address: ccobAddress,
    abi: CROSS_CHAIN_ORDER_BOOK_ABI,
    functionName: 'getOrdersByCreator',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ccobAddress,
    },
  });

  const orders = useMemo<CrossChainOrder[]>(() => {
    if (!data) return [];
    return (data as any[]).map(mapOrder);
  }, [data]);

  return {
    orders,
    isLoading,
    error,
    refetch,
  };
}

export function useCreateCrossChainOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook');

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

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
      });
    },
    [writeContract, ccobAddress]
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
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook');

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const matchOrder = useCallback(
    async (orderId: bigint, htlcSwapId: `0x${string}`) => {
      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'matchOrder',
        args: [orderId, htlcSwapId],
      });
    },
    [writeContract, ccobAddress]
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
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook');

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelOrder = useCallback(
    async (orderId: bigint) => {
      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'cancelOrder',
        args: [orderId],
      });
    },
    [writeContract, ccobAddress]
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

export function useGetChainName(chainId: number): string {
  const config = chainConfig[chainId as SupportedChainId];
  return config?.shortName || `Chain ${chainId}`;
}
