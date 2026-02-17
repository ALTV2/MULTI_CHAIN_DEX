'use client';

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, formatUnits } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress, getSupportedChainIds, getChainConfig } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { ORDER_STATUS } from '@/lib/constants/swap';

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

  // Fetch cross-chain orders
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
            id: `cc-${sourceChainId}-${order.id.toString()}`,
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

  // Fetch same-chain orders
  for (const chainId of chainIds) {
    try {
      const client = getClient(chainId);
      const orderBookAddress = getContractAddress(chainId, 'orderBook');

      const orderCounter = await client.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      }) as bigint;

      if (orderCounter === 0n) continue;

      // Fetch last 20 orders (or less if fewer exist)
      const startId = orderCounter > 20n ? orderCounter - 19n : 1n;

      for (let i = startId; i <= orderCounter; i++) {
        try {
          const order = await client.readContract({
            address: orderBookAddress,
            abi: orderBookABI,
            functionName: 'getOrder',
            args: [i],
          }) as any;

          // Only include active orders
          if (order.status !== ORDER_STATUS.ACTIVE) continue;

          const sellTokenInfo = getTokenByAddress(chainId, order.tokenToSell);
          const buyTokenInfo = getTokenByAddress(chainId, order.tokenToBuy);

          allOrders.push({
            id: `sc-${chainId}-${order.id.toString()}`,
            sourceChainId: chainId,
            targetChainId: chainId, // Same chain
            creator: order.creator,
            sellToken: order.tokenToSell,
            sellSymbol: sellTokenInfo?.symbol || `${order.tokenToSell.slice(0, 6)}...`,
            sellAmount: formatUnits(order.sellAmount, sellTokenInfo?.decimals || 18),
            buyToken: order.tokenToBuy,
            buySymbol: buyTokenInfo?.symbol || `${order.tokenToBuy.slice(0, 6)}...`,
            buyAmount: formatUnits(order.buyAmount, buyTokenInfo?.decimals || 18),
            expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24h default for same-chain
          });
        } catch {
          // Skip individual order on error
        }
      }
    } catch {
      // Skip chain on error
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
