'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCallback } from 'react';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';

export function useCompleteOrder(chainId: number) {
  const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook');

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

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
