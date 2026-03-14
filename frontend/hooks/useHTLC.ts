'use client';

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCallback, useMemo } from 'react';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { getContractAddress } from '@/lib/contracts/addresses';

export type SwapStatus = 'Empty' | 'Active' | 'Withdrawn' | 'Refunded';

export interface HTLCSwap {
  initiator: `0x${string}`;
  participant: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  hashlock: `0x${string}`;
  timelock: bigint;
  status: SwapStatus;
}

const STATUS_MAP: Record<number, SwapStatus> = {
  0: 'Empty',
  1: 'Active',
  2: 'Withdrawn',
  3: 'Refunded',
};

// Generate a random secret
export function generateSecret(): `0x${string}` {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return `0x${Array.from(array, b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

// Generate hashlock from secret
export function generateHashlock(secret: `0x${string}`): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters('bytes32'), [secret]));
}

// Generate swap ID
export function generateSwapId(
  initiator: `0x${string}`,
  participant: `0x${string}`,
  hashlock: `0x${string}`,
  timelock: bigint,
  chainId: number
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, bytes32, uint256, uint256'),
      [initiator, participant, hashlock, timelock, BigInt(chainId)]
    )
  );
}

export function useCreateHTLCSwap(chainId: number) {
  const htlcAddress = getContractAddress(chainId, 'htlc') as `0x${string}`;

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createSwap = useCallback(
    async (params: {
      swapId: `0x${string}`;
      participant: `0x${string}`;
      hashlock: `0x${string}`;
      timelock: bigint;
      token: `0x${string}`;
      amount: bigint;
    }) => {
      const isNativeToken = params.token === '0x0000000000000000000000000000000000000000';

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
        address: htlcAddress,
        abi: HTLC_ABI,
        functionName: 'createSwap',
        args: [
          params.swapId,
          params.participant,
          params.hashlock,
          params.timelock,
          params.token,
          isNativeToken ? BigInt(0) : params.amount,
        ],
        value: isNativeToken ? params.amount : BigInt(0),
        ...gasConfig,
      });
    },
    [writeContract, htlcAddress, chainId]
  );

  return {
    createSwap,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useWithdrawHTLC(chainId: number) {
  const htlcAddress = getContractAddress(chainId, 'htlc') as `0x${string}`;

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = useCallback(
    async (swapId: `0x${string}`, secret: `0x${string}`) => {
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
        address: htlcAddress,
        abi: HTLC_ABI,
        functionName: 'withdraw',
        args: [swapId, secret],
        ...gasConfig,
      });
    },
    [writeContract, htlcAddress, chainId]
  );

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRefundHTLC(chainId: number) {
  const htlcAddress = getContractAddress(chainId, 'htlc') as `0x${string}`;

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const refund = useCallback(
    async (swapId: `0x${string}`) => {
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
        address: htlcAddress,
        abi: HTLC_ABI,
        functionName: 'refund',
        args: [swapId],
        ...gasConfig,
      });
    },
    [writeContract, htlcAddress, chainId]
  );

  return {
    refund,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useHTLCSwap(chainId: number, swapId: `0x${string}` | undefined) {
  const htlcAddress = getContractAddress(chainId, 'htlc') as `0x${string}`;

  const { data, isLoading, error, refetch } = useReadContract({
    address: htlcAddress,
    abi: HTLC_ABI,
    functionName: 'getSwap',
    args: swapId ? [swapId] : undefined,
    query: {
      enabled: !!swapId,
    },
  });

  const swap = useMemo<HTLCSwap | null>(() => {
    if (!data) return null;

    return {
      initiator: data.initiator,
      participant: data.participant,
      token: data.token,
      amount: data.amount,
      hashlock: data.hashlock,
      timelock: data.timelock,
      status: STATUS_MAP[data.status] || 'Empty',
    };
  }, [data]);

  return {
    swap,
    isLoading,
    error,
    refetch,
  };
}

export function useIsSwapActive(chainId: number, swapId: `0x${string}` | undefined) {
  const htlcAddress = getContractAddress(chainId, 'htlc') as `0x${string}`;

  const { data, isLoading, error } = useReadContract({
    address: htlcAddress,
    abi: HTLC_ABI,
    functionName: 'isSwapActive',
    args: swapId ? [swapId] : undefined,
    query: {
      enabled: !!swapId,
    },
  });

  return {
    isActive: data ?? false,
    isLoading,
    error,
  };
}
