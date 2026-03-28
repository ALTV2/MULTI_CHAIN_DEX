'use client';

import { useWriteContract } from 'wagmi';
import { useTxReceipt } from '@/hooks/useTxReceipt';
import { useCallback } from 'react';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';

export function useCompleteOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook') as `0x${string}`;

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useTxReceipt(hash);

  const completeOrder = useCallback(
    async (orderId: bigint) => {
      return writeContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'completeOrder',
        args: [orderId],
      });
    },
    [writeContract, ccobAddress]
  );

  return {
    completeOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
