'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { parseAbiItem, createPublicClient, http } from 'viem';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { getContractAddress } from '@/lib/contracts/addresses';
import { sepolia, polygonAmoy } from 'wagmi/chains';

const SWAP_WITHDRAWN_EVENT = parseAbiItem(
  'event SwapWithdrawn(bytes32 indexed swapId, bytes32 secret, address indexed participant)'
);

const chains: Record<number, (typeof sepolia) | (typeof polygonAmoy)> = {
  [sepolia.id]: sepolia,
  [polygonAmoy.id]: polygonAmoy,
};

function getClient(chainId: number) {
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const rpcUrl = chainId === sepolia.id
    ? (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo')
    : (process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology');

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Search for SwapWithdrawn event by paginating getLogs in small chunks.
 * Alchemy free tier limits eth_getLogs to 10 blocks per request,
 * so we search backwards from the current block in 10-block chunks.
 */
async function findSecretInLogs(
  client: ReturnType<typeof getClient>,
  htlcAddress: `0x${string}`,
  swapId: `0x${string}`,
): Promise<`0x${string}` | null> {
  const currentBlock = await client.getBlockNumber();
  const CHUNK_SIZE = 10n;
  const MAX_BLOCKS = 5000n; // ~16h on Sepolia, ~2.7h on Amoy
  const CONCURRENCY = 10;

  const startBlock = currentBlock > MAX_BLOCKS ? currentBlock - MAX_BLOCKS : 0n;

  // Create chunk ranges from most recent to oldest
  const chunks: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let to = currentBlock; to > startBlock; to -= CHUNK_SIZE) {
    const from = to - CHUNK_SIZE + 1n;
    chunks.push({
      fromBlock: from > startBlock ? from : startBlock,
      toBlock: to,
    });
  }

  // Process batches with limited concurrency, most recent first
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(({ fromBlock, toBlock }) =>
        client.getLogs({
          address: htlcAddress,
          event: SWAP_WITHDRAWN_EVENT,
          args: { swapId },
          fromBlock,
          toBlock,
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        const secret = result.value[0].args.secret;
        if (secret) return secret as `0x${string}`;
      }
    }
  }

  return null;
}

/**
 * Reads the SECRET from the SwapWithdrawn event on a given chain's HTLC contract.
 * Uses paginated getLogs for Alchemy free tier compatibility (10 block limit).
 * Used by the matcher to learn the secret after the creator withdraws.
 */
export function useSwapSecretFromEvent(
  chainId: number,
  swapId: `0x${string}` | undefined,
  enabled: boolean = true
) {
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSearching = useRef(false);

  const fetchSecret = useCallback(async () => {
    if (!swapId || !enabled) return;
    // Prevent concurrent searches
    if (isSearching.current) return;
    isSearching.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const htlcAddress = getContractAddress(chainId, 'htlc');
      const client = getClient(chainId);

      // First: verify the HTLC is actually withdrawn (quick contract read)
      try {
        const swapData = await client.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [swapId],
        }) as any;

        // Status 2 = Withdrawn
        if (swapData.status !== 2) {
          // Not withdrawn yet, no secret to find
          return;
        }
      } catch {
        // Can't verify status, try to find event anyway
      }

      // Search for the SwapWithdrawn event using paginated getLogs
      const found = await findSecretInLogs(client, htlcAddress, swapId);
      if (found) {
        setSecret(found);
      }
    } catch (err: any) {
      console.error('Failed to fetch secret from event:', err);
      setError(err?.message || 'Failed to fetch secret');
    } finally {
      setIsLoading(false);
      isSearching.current = false;
    }
  }, [chainId, swapId, enabled]);

  // Poll every 15 seconds when enabled and no secret found
  useEffect(() => {
    if (!enabled || !swapId || secret) return;

    fetchSecret();

    const interval = setInterval(fetchSecret, 15000);
    return () => clearInterval(interval);
  }, [fetchSecret, enabled, swapId, secret]);

  return {
    secret,
    isLoading,
    error,
    refetch: fetchSecret,
  };
}
