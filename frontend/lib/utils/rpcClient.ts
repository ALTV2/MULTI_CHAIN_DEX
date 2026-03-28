import { createPublicClient, http, type PublicClient } from 'viem';
import { RPC_URLS, CHAIN_MAP } from '@/lib/constants/rpc';

const clientCache = new Map<number, PublicClient>();

export function getPublicClient(chainId: number): PublicClient {
  if (!chainId || chainId === 0) throw new Error(`Chain ${chainId} not supported`);

  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const chain = CHAIN_MAP[chainId];
  if (!chain) throw new Error(`Chain ${chainId} not supported`);

  const client = createPublicClient({
    chain,
    transport: http(RPC_URLS[chainId]),
  });

  clientCache.set(chainId, client);
  return client;
}

/**
 * Wait for a transaction receipt via our own Alchemy RPC.
 * More reliable than wagmi's useWaitForTransactionReceipt which often hangs.
 */
export async function waitForTx(
  chainId: number,
  hash: `0x${string}`,
  timeoutMs = 120_000
): Promise<boolean> {
  try {
    const client = getPublicClient(chainId);
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: timeoutMs,
    });
    return receipt.status === 'success';
  } catch {
    return false;
  }
}
