'use client';

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, formatUnits } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress, getSupportedChainIds, getChainConfig } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';

export interface LiveOrder {
  id: string;
  sourceChainId: number;
  targetChainId: number;
  creator: string;
  sellToken: string;
  sellSymbol: string;
  sellAmount: string;
  buyToken: string;
  buySymbol: string;
  buyAmount: string;
  expiresAt: number;
}

const chains: Record<number, typeof sepolia | typeof polygonAmoy> = {
  [sepolia.id]: sepolia,
  [polygonAmoy.id]: polygonAmoy,
};

function getClient(chainId: number) {
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const rpcUrl = chainId === sepolia.id
    ? (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo')
    : (process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology');

  return createPublicClient({ chain, transport: http(rpcUrl) });
}

async function fetchAllActiveOrders(): Promise<LiveOrder[]> {
  const chainIds = getSupportedChainIds();
  const allOrders: LiveOrder[] = [];

  for (const sourceChainId of chainIds) {
    const client = getClient(sourceChainId);
    const ccobAddress = getContractAddress(sourceChainId, 'crossChainOrderBook');

    for (const targetChainId of chainIds) {
      if (targetChainId === sourceChainId) continue;

      try {
        const orders = await client.readContract({
          address: ccobAddress,
          abi: CROSS_CHAIN_ORDER_BOOK_ABI,
          functionName: 'getActiveOrdersForTargetChain',
          args: [BigInt(targetChainId)],
        }) as any[];

        for (const order of orders) {
          const sellTokenInfo = getTokenByAddress(sourceChainId, order.sellToken);
          const buyTokenInfo = getTokenByAddress(Number(order.targetChainId), order.buyToken);

          allOrders.push({
            id: `${sourceChainId}-${order.id.toString()}`,
            sourceChainId,
            targetChainId: Number(order.targetChainId),
            creator: order.creator,
            sellToken: order.sellToken,
            sellSymbol: sellTokenInfo?.symbol || `${order.sellToken.slice(0, 6)}...`,
            sellAmount: formatUnits(order.sellAmount, sellTokenInfo?.decimals || 18),
            buyToken: order.buyToken,
            buySymbol: buyTokenInfo?.symbol || `${order.buyToken.slice(0, 6)}...`,
            buyAmount: formatUnits(order.buyAmount, buyTokenInfo?.decimals || 18),
            expiresAt: Number(order.expiresAt),
          });
        }
      } catch {
        // Skip chain pair on error
      }
    }
  }

  // Sort by expiry (most recent first) and return top 20
  return allOrders
    .sort((a, b) => b.expiresAt - a.expiresAt)
    .slice(0, 20);
}

export function useLiveOrderFeed() {
  return useQuery({
    queryKey: ['liveOrderFeed'],
    queryFn: fetchAllActiveOrders,
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
