'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
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
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  // Check current allowance
  const allowanceQuery = useQuery({
    queryKey: ['allowance', tokenAddress, userAddress, spenderAddress],
    queryFn: async () => {
      if (!publicClient || !userAddress || !tokenAddress || isNativeToken(tokenAddress)) {
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
      !isNativeToken(tokenAddress),
  });

  // Wait for approval transaction
  const { isLoading: isWaiting, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!tokenAddress || isNativeToken(tokenAddress)) {
        throw new Error('Cannot approve ETH');
      }

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'approve',
        args: [spenderAddress, maxUint256], // Approve max for better UX
      });

      setTxHash(hash);
      return hash;
    },
    onSuccess: () => {
      // Refetch allowance after successful approval
      queryClient.invalidateQueries({
        queryKey: ['allowance', tokenAddress, userAddress, spenderAddress],
      });
    },
  });

  const allowance = allowanceQuery.data ?? 0n;
  const needsApproval =
    tokenAddress && !isNativeToken(tokenAddress) && allowance < amount;

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
  };
}
