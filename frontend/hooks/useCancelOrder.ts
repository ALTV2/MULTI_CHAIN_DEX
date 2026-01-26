'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';
import { parseContractError } from '@/lib/utils/errors';

export function useCancelOrder() {
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const orderBookAddress = getContractAddress(chainId, 'orderBook');

  // Wait for transaction
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const mutation = useMutation({
    mutationFn: async (orderId: bigint) => {
      const hash = await writeContractAsync({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'cancelOrder',
        args: [orderId],
      });

      setTxHash(hash);
      return hash;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
    },
  });

  return {
    cancelOrder: mutation.mutateAsync,
    isCancelling: mutation.isPending || isWaiting,
    isSuccess,
    txHash,
    error: mutation.error ? parseContractError(mutation.error) : null,
    reset: () => {
      mutation.reset();
      setTxHash(undefined);
    },
  };
}
