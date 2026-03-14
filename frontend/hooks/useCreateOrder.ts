'use client';

import { useState, useEffect } from 'react';
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

  const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

  // Wait for transaction
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Invalidate caches after transaction is confirmed
  useEffect(() => {
    if (isSuccess && txHash) {
      console.log('✅ Same-chain order created, invalidating all order caches');
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
    }
  }, [isSuccess, txHash, queryClient]);

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
        functionName: 'createOrder',
        args: [tokenToSell, tokenToBuy, parsedSellAmount, parsedBuyAmount],
        value: isNativeToken(chainId, tokenToSell) ? parsedSellAmount : 0n,
        ...gasParams,
      });

      setTxHash(hash);
      return hash;
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
