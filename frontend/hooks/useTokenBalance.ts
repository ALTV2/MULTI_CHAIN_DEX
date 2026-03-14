'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount, usePublicClient, useBalance, useChainId } from 'wagmi';
import { erc20ABI } from '@/lib/contracts/abis/ERC20';
import { isNativeToken } from '@/lib/constants/tokens';
import { formatUnits } from 'viem';

export function useTokenBalance(
  tokenAddress: `0x${string}` | undefined,
  decimals: number = 18
) {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // Use native balance hook for ETH
  const ethBalance = useBalance({
    address: userAddress,
    query: {
      enabled: !!userAddress && !!tokenAddress && isNativeToken(chainId, tokenAddress),
    },
  });

  // Use custom query for ERC20 tokens
  const erc20Balance = useQuery({
    queryKey: ['tokenBalance', tokenAddress, userAddress],
    queryFn: async () => {
      if (!publicClient || !userAddress || !tokenAddress || isNativeToken(chainId, tokenAddress)) {
        return 0n;
      }

      return publicClient.readContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });
    },
    enabled: !!publicClient && !!userAddress && !!tokenAddress && !isNativeToken(chainId, tokenAddress),
  });

  const isEth = tokenAddress ? isNativeToken(chainId, tokenAddress) : false;
  const balance = isEth ? ethBalance.data?.value : erc20Balance.data;
  const isLoading = isEth ? ethBalance.isLoading : erc20Balance.isLoading;

  return {
    balance: balance ?? 0n,
    formattedBalance: balance ? formatUnits(balance, decimals) : '0',
    isLoading,
    refetch: isEth ? ethBalance.refetch : erc20Balance.refetch,
  };
}
