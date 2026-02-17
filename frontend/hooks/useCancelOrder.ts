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
      console.log('🗑️ useCancelOrder: Cancelling same-chain order', {
        orderId: orderId.toString(),
        chainId,
        orderBookAddress,
      });

      // Polygon requires higher gas fees (min 25 gwei tip)
      const isPolygon = chainId === 137 || chainId === 80002; // Polygon Mainnet or Amoy testnet
      const gasParams = isPolygon
        ? {
            maxPriorityFeePerGas: 30000000000n, // 30 gwei
            maxFeePerGas: 50000000000n, // 50 gwei
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

      console.log('✅ Cancel tx hash:', hash);
      setTxHash(hash);
      return hash;
    },
    onSuccess: () => {
      console.log('✅ Same-chain order cancelled, invalidating caches');
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
