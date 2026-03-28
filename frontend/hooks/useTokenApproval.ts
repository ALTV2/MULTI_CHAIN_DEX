'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWriteContract, useChainId } from 'wagmi';
import { erc20ABI } from '@/lib/contracts/abis/ERC20';
import { isNativeToken } from '@/lib/constants/tokens';
import { parseContractError } from '@/lib/utils/errors';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { maxUint256 } from 'viem';

/** Poll allowance until it meets the required amount (or timeout) */
async function pollAllowance(
  chainId: number,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  requiredAmount: bigint,
  timeoutMs = 90_000
): Promise<boolean> {
  const client = getPublicClient(chainId);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const allowance = await client.readContract({
        address: token,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [owner, spender],
      }) as bigint;
      if (allowance >= requiredAmount) return true;
    } catch { /* ignore RPC errors, retry */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

/**
 * @param targetChainId — the chain where the token lives (may differ from wallet's current chain)
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
  // Use explicit targetChainId if provided, otherwise fall back to wallet chain
  const chainId = targetChainId ?? walletChainId;
  const [isApproving, setIsApproving] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Check current allowance via our Alchemy RPC (uses the TARGET chain, not wallet chain)
  const allowanceQuery = useQuery({
    queryKey: ['allowance', tokenAddress, userAddress, spenderAddress, chainId],
    queryFn: async () => {
      if (!userAddress || !tokenAddress || isNativeToken(chainId, tokenAddress)) {
        return maxUint256;
      }
      const client = getPublicClient(chainId);
      return client.readContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [userAddress, spenderAddress],
      });
    },
    enabled: !!userAddress && !!tokenAddress && !isNativeToken(chainId, tokenAddress) && chainId > 0,
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

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'approve',
        args: [spenderAddress, maxUint256],
        gas: 100000n,
        ...gasParams,
      });

      // Poll allowance on the correct chain until it's sufficient (max 90s)
      const ok = await pollAllowance(chainId, tokenAddress, userAddress, spenderAddress, amount);

      // Refresh the cached allowance
      await queryClient.invalidateQueries({
        queryKey: ['allowance', tokenAddress, userAddress, spenderAddress, chainId],
      });

      if (!ok) {
        throw new Error('Approval transaction may still be pending. Please try again.');
      }

      return hash;
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
