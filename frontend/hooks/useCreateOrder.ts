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
import { isNativeToken } from '@/lib/constants/tokens';
import { parseContractError } from '@/lib/utils/errors';
import { parseUnits } from 'viem';

interface CreateOrderParams {
  tokenToSell: `0x${string}`;
  tokenToBuy: `0x${string}`;
  sellAmount: string;
  buyAmount: string;
  sellDecimals: number;
  buyDecimals: number;
}

export function useCreateOrder() {
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
    mutationFn: async ({
      tokenToSell,
      tokenToBuy,
      sellAmount,
      buyAmount,
      sellDecimals,
      buyDecimals,
    }: CreateOrderParams) => {
      const parsedSellAmount = parseUnits(sellAmount, sellDecimals);
      const parsedBuyAmount = parseUnits(buyAmount, buyDecimals);

      const hash = await writeContractAsync({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'createOrder',
        args: [tokenToSell, tokenToBuy, parsedSellAmount, parsedBuyAmount],
        value: isNativeToken(tokenToSell) ? parsedSellAmount : 0n,
      });

      setTxHash(hash);
      return hash;
    },
    onSuccess: () => {
      // Invalidate order book queries
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
    },
  });

  return {
    createOrder: mutation.mutateAsync,
    isCreating: mutation.isPending || isWaiting,
    isSuccess,
    txHash,
    error: mutation.error ? parseContractError(mutation.error) : null,
    reset: () => {
      mutation.reset();
      setTxHash(undefined);
    },
  };
}
