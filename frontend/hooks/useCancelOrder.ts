'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useWriteContract,
  useChainId,
} from 'wagmi';
import { useTxReceipt } from '@/hooks/useTxReceipt';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress } from '@/lib/contracts/addresses';
import { parseContractError } from '@/lib/utils/errors';

export function useCancelOrder() {
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

  // Wait for transaction
  const { isLoading: isWaiting, isSuccess } = useTxReceipt(txHash);

  const mutation = useMutation({
    mutationFn: async (orderId: bigint) => {
      // Polygon requires higher gas fees (min 25 gwei tip)
      const isPolygon = chainId === 137 || chainId === 80002;
      const gasParams = isPolygon
        ? {
            maxPriorityFeePerGas: 30000000000n,
            maxFeePerGas: 50000000000n,
          }
        : {};

      const hash = await writeContractAsync({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'cancelOrder',
        args: [orderId],
        gas: 300000n,
        ...gasParams,
      });

      setTxHash(hash);
      return hash;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
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
