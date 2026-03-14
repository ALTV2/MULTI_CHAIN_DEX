'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { erc20ABI } from '@/lib/contracts/abis/ERC20';
import { isNativeToken } from '@/lib/constants/tokens';
import { parseContractError } from '@/lib/utils/errors';
import { maxUint256 } from 'viem';

export function useTokenApproval(
  tokenAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}`,
  amount: bigint
) {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  // Check current allowance
  const allowanceQuery = useQuery({
    queryKey: ['allowance', tokenAddress, userAddress, spenderAddress],
    queryFn: async () => {
      if (!publicClient || !userAddress || !tokenAddress || isNativeToken(chainId, tokenAddress)) {
        return maxUint256; // ETH doesn't need approval
      }

      return publicClient.readContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [userAddress, spenderAddress],
      });
    },
    enabled:
      !!publicClient &&
      !!userAddress &&
      !!tokenAddress &&
      !isNativeToken(chainId, tokenAddress),
  });

  // Wait for approval transaction (only when txHash is available)
  const { isLoading: isWaiting, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
      query: { enabled: !!txHash },
    });

  // Invalidate allowance cache after transaction is confirmed
  useEffect(() => {
    if (isConfirmed && txHash) {
      console.log('✅ Approval confirmed, invalidating allowance cache');

      // Refetch allowance after successful confirmation
      queryClient.invalidateQueries({
        queryKey: ['allowance', tokenAddress, userAddress, spenderAddress],
      });

      // Reset txHash so we can approve again if needed
      setTimeout(() => setTxHash(undefined), 1000);
    }
  }, [isConfirmed, txHash, queryClient, tokenAddress, userAddress, spenderAddress]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!tokenAddress || isNativeToken(chainId, tokenAddress)) {
        throw new Error('Cannot approve ETH');
      }

      console.log('Approving token:', tokenAddress, 'for spender:', spenderAddress);

      // Polygon requires higher gas fees (min 25 gwei tip)
      const isPolygon = chainId === 137 || chainId === 80002; // Polygon Mainnet or Amoy testnet
      const gasParams = isPolygon
        ? {
            maxPriorityFeePerGas: 30000000000n, // 30 gwei
            maxFeePerGas: 50000000000n, // 50 gwei
          }
        : {};

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'approve',
        args: [spenderAddress, maxUint256], // Approve max for better UX
        gas: 100000n,
        ...gasParams,
      });

      console.log('Approve tx hash:', hash);
      setTxHash(hash);
      return hash;
    },
  });

  const allowance = allowanceQuery.data ?? 0n;
  const needsApproval =
    tokenAddress && !isNativeToken(chainId, tokenAddress) && allowance < amount;

  return {
    allowance,
    needsApproval,
    isCheckingAllowance: allowanceQuery.isLoading,
    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending || isWaiting,
    isApproved: isConfirmed || (allowance >= amount),
    error: approveMutation.error
      ? parseContractError(approveMutation.error)
      : null,
    refetchAllowance: allowanceQuery.refetch,
    txHash,
  };
}
