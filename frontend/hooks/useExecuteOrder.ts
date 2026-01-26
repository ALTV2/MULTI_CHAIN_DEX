'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { tradeABI } from '@/lib/contracts/abis/Trade';
import { getContractAddress } from '@/lib/contracts/addresses';
import { isNativeToken } from '@/lib/constants/tokens';
import { parseContractError } from '@/lib/utils/errors';

interface ExecuteOrderParams {
  orderId: bigint;
  tokenToBuy: `0x${string}`;
  buyAmount: bigint;
}

export function useExecuteOrder() {
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const tradeAddress = getContractAddress(chainId, 'trade');

  // Wait for transaction
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const mutation = useMutation({
    mutationFn: async ({
      orderId,
      tokenToBuy,
      buyAmount,
    }: ExecuteOrderParams) => {
      // If the order creator is buying ETH, executor needs to send ETH
      // tokenToBuy in the order = what the creator wants to receive
      // So if tokenToBuy (what creator receives) is NOT ETH,
      // executor sends ERC20 and receives whatever creator was selling
      const hash = await writeContractAsync({
        address: tradeAddress,
        abi: tradeABI,
        functionName: 'executeOrder',
        args: [orderId],
        value: isNativeToken(tokenToBuy) ? buyAmount : 0n,
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
    executeOrder: mutation.mutateAsync,
    isExecuting: mutation.isPending || isWaiting,
    isSuccess,
    txHash,
    error: mutation.error ? parseContractError(mutation.error) : null,
    reset: () => {
      mutation.reset();
      setTxHash(undefined);
    },
  };
}
