import { createPublicClient, http, type PublicClient } from 'viem';
import { RPC_URLS, CHAIN_MAP } from '@/lib/constants/rpc';

const clientCache = new Map<number, PublicClient>();

export function getPublicClient(chainId: number): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const chain = CHAIN_MAP[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const client = createPublicClient({
    chain,
    transport: http(RPC_URLS[chainId]),
  });

  clientCache.set(chainId, client);
  return client;
}
