'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useWriteContract,
  useChainId,
  useAccount,
  usePublicClient,
} from 'wagmi';
import { useTxReceipt } from '@/hooks/useTxReceipt';
import { tradeABI } from '@/lib/contracts/abis/Trade';
import { erc20Abi } from 'viem';
import { getContractAddress } from '@/lib/contracts/addresses';
import { isNativeToken } from '@/lib/constants/tokens';
import { parseContractError } from '@/lib/utils/errors';
// No direct Alchemy/RPC — uses wagmi publicClient via wallet

interface ExecuteOrderParams {
  orderId: bigint;
  tokenToBuy: `0x${string}`;
  buyAmount: bigint;
}

export function useExecuteOrder() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const tradeAddress = getContractAddress(chainId, 'trade') as `0x${string}`;

  // Wait for transaction
  const { isLoading: isWaiting, isSuccess } = useTxReceipt(txHash);

  const mutation = useMutation({
    mutationFn: async ({
      orderId,
      tokenToBuy,
      buyAmount,
    }: ExecuteOrderParams) => {
      // Polygon requires higher gas fees (min 25 gwei tip)
      const isPolygon = chainId === 137 || chainId === 80002; // Polygon Mainnet or Amoy testnet
      const gasParams = isPolygon
        ? {
            maxPriorityFeePerGas: 30000000000n, // 30 gwei
            maxFeePerGas: 50000000000n, // 50 gwei
          }
        : {};

      // If tokenToBuy is NOT a native token (ETH), need to approve ERC20
      if (!isNativeToken(chainId, tokenToBuy) && address) {
        console.log('Checking allowance for token:', tokenToBuy);

        if (!publicClient) throw new Error('Wallet not connected');

        // Check current allowance
        const allowance = await publicClient.readContract({
          address: tokenToBuy,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, tradeAddress],
        }) as bigint;

        console.log('Current allowance:', allowance.toString(), 'Required:', buyAmount.toString());

        // If allowance is insufficient, approve
        if (allowance < buyAmount) {
          console.log('Approving token...');
          const approveHash = await writeContractAsync({
            address: tokenToBuy,
            abi: erc20Abi,
            functionName: 'approve',
            args: [tradeAddress, buyAmount],
            gas: 100000n,
            ...gasParams,
          });

          console.log('Approve tx:', approveHash);

          // Wait for approve transaction to complete
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
          });

          if (approveReceipt.status !== 'success') {
            throw new Error('Approve transaction failed');
          }
        }
      }

      // Now execute the order
      const hash = await writeContractAsync({
        address: tradeAddress,
        abi: tradeABI,
        functionName: 'executeOrder',
        args: [orderId],
        value: isNativeToken(chainId, tokenToBuy) ? buyAmount : 0n,
        gas: 500000n,
        ...gasParams,
      });

      setTxHash(hash);
      return hash;
    },
    onSuccess: () => {
      // Invalidate all order-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myeCrossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });

      console.log('✅ Order executed successfully - invalidating all caches');
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
