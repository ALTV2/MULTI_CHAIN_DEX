'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useChainId, usePublicClient } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { erc20ABI } from '@/lib/contracts/abis/ERC20';
import { isNativeToken } from '@/lib/constants/tokens';
import { maxUint256 } from 'viem';
import { computeApprovalAmount } from '@/lib/utils/approval';

/**
 * Token approval hook. Uses wagmi's publicClient (wallet RPC) for allowance checks —
 * no direct Alchemy calls. Approval tx signed via wallet.
 *
 * @param targetChainId explicit chain ID for allowance check (may differ from wallet's current chain)
 */
export function useTokenApproval(
  tokenAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}`,
  amount: bigint,
  targetChainId?: number
) {
  const { address: userAddress } = useAccount();
  const queryClient = useQueryClient();
  const walletChainId = useChainId();
  const chainId = targetChainId ?? walletChainId;
  const publicClient = usePublicClient({ chainId });
  const [isApproving, setIsApproving] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Check current allowance via wallet's RPC (no Alchemy)
  const allowanceQuery = useQuery({
    queryKey: ['allowance', tokenAddress, userAddress, spenderAddress, chainId],
    queryFn: async () => {
      if (!publicClient || !userAddress || !tokenAddress || isNativeToken(chainId, tokenAddress)) {
        return maxUint256;
      }
      return publicClient.readContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [userAddress, spenderAddress],
      });
    },
    enabled: !!publicClient && !!userAddress && !!tokenAddress && !isNativeToken(chainId, tokenAddress) && chainId > 0,
    staleTime: 30_000,
  });

  const approve = async () => {
    if (!tokenAddress || !userAddress || isNativeToken(chainId, tokenAddress)) {
      throw new Error('Cannot approve native token');
    }

    setIsApproving(true);
    try {
      const isPolygon = chainId === 137 || chainId === 80002;
      const gasParams = isPolygon
        ? { maxPriorityFeePerGas: 30000000000n, maxFeePerGas: 50000000000n }
        : {};

      await writeContractAsync({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'approve',
        // C-APPROVE: approve exactly what this swap needs, not an unbounded maxUint256 allowance
        args: [spenderAddress, computeApprovalAmount(amount)],
        gas: 100000n,
        ...gasParams,
      });

      // Wait for approval to propagate, then re-check allowance
      await new Promise((r) => setTimeout(r, 5000));
      await queryClient.invalidateQueries({
        queryKey: ['allowance', tokenAddress, userAddress, spenderAddress, chainId],
      });

      return;
    } finally {
      setIsApproving(false);
    }
  };

  const allowance = allowanceQuery.data ?? 0n;
  const needsApproval =
    tokenAddress && !isNativeToken(chainId, tokenAddress) && allowance < amount;

  return {
    allowance,
    needsApproval,
    isCheckingAllowance: allowanceQuery.isLoading,
    approve,
    isApproving,
    isApproved: allowance >= amount,
    error: null as string | null,
    refetchAllowance: allowanceQuery.refetch,
  };
}
