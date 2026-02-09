'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress, getSupportedChainIds } from '@/lib/contracts/addresses';
import { getSwaps, getSwap, saveSwap, updateSwap } from '@/lib/utils/swapStorage';
import { determineSwapPhase } from '@/lib/utils/swapPhase';
import type { StoredSwapMeta, ActiveSwap } from '@/types/swap';

const STATUS_MAP: Record<number, string> = {
  0: 'Empty',
  1: 'Active',
  2: 'Withdrawn',
  3: 'Refunded',
};

const ORDER_STATUS_MAP: Record<number, string> = {
  0: 'Active',
  1: 'Matched',
  2: 'Completed',
  3: 'Cancelled',
  4: 'Expired',
};

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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Scan CCOB contracts on all chains to discover orders where the wallet is
 * either the creator or the matcher. Uses direct contract reads (not event logs)
 * for maximum reliability across RPC providers.
 * Returns the number of newly discovered swaps.
 */
async function scanBlockchainForSwaps(walletAddress: string): Promise<number> {
  const chainIds = getSupportedChainIds();
  const lowerWallet = walletAddress.toLowerCase();
  let discovered = 0;

  for (const chainId of chainIds) {
    try {
      const client = getClient(chainId);
      const ccobAddress = getContractAddress(chainId, 'crossChainOrderBook');

      // 1. Find orders where user is creator (using getOrdersByCreator)
      try {
        const creatorOrders = await client.readContract({
          address: ccobAddress,
          abi: CROSS_CHAIN_ORDER_BOOK_ABI,
          functionName: 'getOrdersByCreator',
          args: [walletAddress as `0x${string}`],
        }) as any[];

        console.log(`[scan] Chain ${chainId}: ${creatorOrders.length} creator orders`);

        for (const order of creatorOrders) {
          const orderId = order.id.toString();
          const existing = getSwap(walletAddress, orderId, chainId);

          if (existing) {
            // Update matcher if discovered on-chain but missing locally
            const matchedBy = order.matchedBy as string;
            if (matchedBy && matchedBy !== ZERO_ADDRESS && !existing.matcher) {
              updateSwap(walletAddress, orderId, { matcher: matchedBy }, chainId);
            }
            continue;
          }

          const matchedBy = order.matchedBy as string;
          const meta: StoredSwapMeta = {
            orderId,
            role: 'creator',
            sourceChainId: chainId,
            targetChainId: Number(order.targetChainId),
            hashlock: '',
            sellToken: order.sellToken,
            sellAmount: order.sellAmount.toString(),
            buyToken: order.buyToken,
            buyAmount: order.buyAmount.toString(),
            creator: order.creator,
            matcher: matchedBy !== ZERO_ADDRESS ? matchedBy : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          saveSwap(walletAddress, meta);
          discovered++;
        }
      } catch (err) {
        console.error(`[scan] Failed to fetch creator orders on chain ${chainId}:`, err);
      }

      // 2. Find orders where user is matcher (iterate all orders, check matchedBy)
      try {
        const totalOrders = await client.readContract({
          address: ccobAddress,
          abi: CROSS_CHAIN_ORDER_BOOK_ABI,
          functionName: 'getTotalOrders',
        }) as bigint;

        console.log(`[scan] Chain ${chainId}: totalOrders=${totalOrders}, scanning for matcher role...`);

        // Use <= because contract uses 1-based IDs (order IDs go from 1 to totalOrders)
        for (let i = 0; i <= Number(totalOrders); i++) {
          try {
            const order = await client.readContract({
              address: ccobAddress,
              abi: CROSS_CHAIN_ORDER_BOOK_ABI,
              functionName: 'getOrder',
              args: [BigInt(i)],
            }) as any;

            const matchedBy = (order.matchedBy as string) || '';
            if (matchedBy.toLowerCase() !== lowerWallet) continue;

            // Use on-chain order ID, not loop index
            const orderId = order.id.toString();
            console.log(`[scan] Chain ${chainId}: order #${orderId} matched by current wallet`);

            const existing = getSwap(walletAddress, orderId, chainId);
            if (existing) {
              // Sync creator/matcher if missing
              if (!existing.creator && order.creator) {
                updateSwap(walletAddress, orderId, { creator: order.creator }, chainId);
              }
              continue;
            }

            const meta: StoredSwapMeta = {
              orderId,
              role: 'matcher',
              sourceChainId: chainId,
              targetChainId: Number(order.targetChainId),
              hashlock: '',
              sellToken: order.sellToken,
              sellAmount: order.sellAmount.toString(),
              buyToken: order.buyToken,
              buyAmount: order.buyAmount.toString(),
              creator: order.creator,
              matcher: walletAddress,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            saveSwap(walletAddress, meta);
            discovered++;
            console.log(`[scan] Saved matcher swap: order #${orderId} on chain ${chainId}`);
          } catch (err) {
            console.warn(`[scan] Failed to read order ${i} on chain ${chainId}:`, err);
          }
        }
      } catch (err) {
        console.error(`[scan] Failed to scan matcher orders on chain ${chainId}:`, err);
      }
    } catch (err) {
      console.error(`[scan] Failed to scan chain ${chainId}:`, err);
    }
  }

  console.log(`[scan] Done. Discovered ${discovered} new swaps.`);
  return discovered;
}

/**
 * Discover a user's HTLC swap ID by scanning getSwapsAsInitiator on the HTLC contract.
 * Matches by participant address and optionally by hashlock.
 * When no hashlock filter: prefers Active non-expired HTLCs over old expired ones.
 */
async function discoverHTLCSwap(
  client: ReturnType<typeof getClient>,
  chainId: number,
  initiator: string,
  participant: string,
  matchHashlock?: string
): Promise<{ swapId: string; hashlock: string; status: string; timelock: bigint } | null> {
  try {
    const htlcAddress = getContractAddress(chainId, 'htlc');
    const swapIds = await client.readContract({
      address: htlcAddress,
      abi: HTLC_ABI,
      functionName: 'getSwapsAsInitiator',
      args: [initiator as `0x${string}`],
    }) as `0x${string}`[];

    const lowerParticipant = participant.toLowerCase();
    const now = BigInt(Math.floor(Date.now() / 1000));

    type HTLCMatch = { swapId: string; hashlock: string; status: string; timelock: bigint };
    let bestActive: HTLCMatch | null = null;       // Active + non-expired (preferred)
    let bestExpired: HTLCMatch | null = null;       // Active but expired (fallback)
    let bestWithdrawn: HTLCMatch | null = null;     // Withdrawn (last resort)

    for (let i = swapIds.length - 1; i >= 0; i--) {
      try {
        const swapData = await client.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [swapIds[i]],
        }) as any;

        const status = STATUS_MAP[swapData.status] || 'Empty';
        if (status === 'Empty' || status === 'Refunded') continue;

        if (swapData.participant.toLowerCase() !== lowerParticipant) continue;

        // If we have a hashlock to match, check it — exact match required
        if (matchHashlock && swapData.hashlock !== matchHashlock) continue;

        const match: HTLCMatch = {
          swapId: swapIds[i],
          hashlock: swapData.hashlock,
          status,
          timelock: swapData.timelock,
        };

        // If hashlock filter is provided, return first match (reverse = most recent)
        if (matchHashlock) return match;

        // Without hashlock filter, categorize and pick best
        if (status === 'Active' && swapData.timelock > now) {
          // Prefer the one with the longest remaining timelock
          if (!bestActive || swapData.timelock > bestActive.timelock) {
            bestActive = match;
          }
        } else if (status === 'Active') {
          if (!bestExpired || swapData.timelock > bestExpired.timelock) {
            bestExpired = match;
          }
        } else if (status === 'Withdrawn') {
          if (!bestWithdrawn) bestWithdrawn = match;
        }
      } catch {
        continue;
      }
    }

    // Return best match: prefer active non-expired > active expired > withdrawn
    return bestActive || bestExpired || bestWithdrawn || null;
  } catch (err) {
    console.error(`discoverHTLCSwap failed on chain ${chainId}:`, err);
  }
  return null;
}

async function fetchSwapOnChainData(meta: StoredSwapMeta, walletAddress: string): Promise<ActiveSwap> {
  try {
    const sourceClient = getClient(meta.sourceChainId);
    const targetClient = getClient(meta.targetChainId);
    const updates: Partial<StoredSwapMeta> = {};

    // Step 1: Fetch CCOB order status from source chain, sync matcher
    const ccobAddress = getContractAddress(meta.sourceChainId, 'crossChainOrderBook');
    let orderStatus: string | undefined;

    try {
      const orderData = await sourceClient.readContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'getOrder',
        args: [BigInt(meta.orderId)],
      }) as any;
      orderStatus = ORDER_STATUS_MAP[orderData.status] || 'Active';

      const matchedBy = orderData.matchedBy as string;
      if (matchedBy && matchedBy !== ZERO_ADDRESS && !meta.matcher) {
        updates.matcher = matchedBy;
        meta = { ...meta, matcher: matchedBy };
      }
    } catch {
      // Order might not exist or RPC error
    }

    // Step 2: Discover creator's HTLC on source chain if not known
    let creatorHtlcStatus: string | undefined;
    let creatorHtlcTimelock: bigint | undefined;

    if (!meta.creatorHtlcSwapId && meta.creator && meta.matcher) {
      // Scan on-chain: creator created an HTLC on source chain with matcher as participant
      const found = await discoverHTLCSwap(
        sourceClient, meta.sourceChainId,
        meta.creator, meta.matcher,
        meta.hashlock || undefined // match by hashlock if we have it
      );
      if (found) {
        updates.creatorHtlcSwapId = found.swapId;
        meta = { ...meta, creatorHtlcSwapId: found.swapId };
        creatorHtlcStatus = found.status;
        creatorHtlcTimelock = found.timelock;
        // Also sync hashlock from on-chain
        if (!meta.hashlock || meta.hashlock === '') {
          updates.hashlock = found.hashlock;
          meta = { ...meta, hashlock: found.hashlock };
        }
      }
    }

    // Fetch creator HTLC status if we have the swap ID (and didn't already fetch via discovery)
    if (meta.creatorHtlcSwapId && !creatorHtlcStatus) {
      try {
        const htlcAddress = getContractAddress(meta.sourceChainId, 'htlc');
        const swapData = await sourceClient.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [meta.creatorHtlcSwapId as `0x${string}`],
        }) as any;
        creatorHtlcStatus = STATUS_MAP[swapData.status] || 'Empty';
        creatorHtlcTimelock = swapData.timelock;
        // Sync hashlock from on-chain if missing
        if ((!meta.hashlock || meta.hashlock === '') && swapData.hashlock) {
          updates.hashlock = swapData.hashlock;
          meta = { ...meta, hashlock: swapData.hashlock };
        }
      } catch {
        // HTLC might not exist
      }
    }

    // Step 3: Discover matcher's HTLC on target chain if not known
    let matcherHtlcStatus: string | undefined;
    let matcherHtlcTimelock: bigint | undefined;

    if (!meta.matcherHtlcSwapId && meta.matcher && meta.creator && meta.hashlock) {
      // Scan on-chain: matcher created an HTLC on target chain with creator as participant, same hashlock
      const found = await discoverHTLCSwap(
        targetClient, meta.targetChainId,
        meta.matcher, meta.creator,
        meta.hashlock // MUST match hashlock
      );
      if (found) {
        updates.matcherHtlcSwapId = found.swapId;
        meta = { ...meta, matcherHtlcSwapId: found.swapId };
        matcherHtlcStatus = found.status;
        matcherHtlcTimelock = found.timelock;
      }
    }

    // Fetch matcher HTLC status if we have the swap ID (and didn't already fetch via discovery)
    if (meta.matcherHtlcSwapId && !matcherHtlcStatus) {
      try {
        const htlcAddress = getContractAddress(meta.targetChainId, 'htlc');
        const swapData = await targetClient.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [meta.matcherHtlcSwapId as `0x${string}`],
        }) as any;
        matcherHtlcStatus = STATUS_MAP[swapData.status] || 'Empty';
        matcherHtlcTimelock = swapData.timelock;
      } catch {
        // HTLC might not exist
      }
    }

    // Step 4: Persist any discovered data back to localStorage
    if (Object.keys(updates).length > 0) {
      updateSwap(walletAddress, meta.orderId, updates, meta.sourceChainId);
    }

    const phase = determineSwapPhase({
      meta,
      orderStatus,
      creatorHtlcStatus,
      matcherHtlcStatus,
      creatorHtlcTimelock,
      matcherHtlcTimelock,
    });

    return {
      meta,
      phase,
      orderStatus,
      creatorHtlcStatus,
      matcherHtlcStatus,
      creatorHtlcTimelock,
      matcherHtlcTimelock,
    };
  } catch (err) {
    // Fallback: return with minimal info
    return {
      meta,
      phase: determineSwapPhase({ meta }),
    };
  }
}

export function useActiveSwaps() {
  const { address } = useAccount();
  const [swaps, setSwaps] = useState<ActiveSwap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);
  const lastScanTime = useRef(0);
  const forceNextScan = useRef(true); // Always scan on first mount

  const fetchAll = useCallback(async () => {
    if (!address) {
      setSwaps([]);
      return;
    }

    setIsLoading(true);

    try {
      // Run blockchain scan if: first load, forced, or 30+ seconds since last scan
      const now = Date.now();
      const shouldScan = forceNextScan.current || (now - lastScanTime.current > 30000);

      if (shouldScan) {
        try {
          console.log(`[useActiveSwaps] Running blockchain scan for ${address}...`);
          await scanBlockchainForSwaps(address);
          lastScanTime.current = now;
          forceNextScan.current = false;
        } catch (err) {
          console.error('Blockchain scan failed:', err);
        }
      }

      const stored = getSwaps(address);
      console.log(`[useActiveSwaps] localStorage has ${stored.length} swaps for ${address.slice(0, 8)}...`);

      if (stored.length === 0) {
        setSwaps([]);
        return;
      }

      const results = await Promise.all(
        stored.map((meta) => fetchSwapOnChainData(meta, address))
      );

      setSwaps(results);
    } catch (err) {
      console.error('Failed to fetch active swaps:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Initial fetch and refresh
  useEffect(() => {
    fetchAll();
  }, [fetchAll, lastRefresh]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const refetch = useCallback(() => {
    forceNextScan.current = true; // Force scan on manual refresh
    setLastRefresh(Date.now());
  }, []);

  const activeSwaps = useMemo(
    () => swaps.filter((s) => !['completed', 'refunded'].includes(s.phase)),
    [swaps]
  );

  const historySwaps = useMemo(
    () => swaps.filter((s) => ['completed', 'refunded'].includes(s.phase)),
    [swaps]
  );

  return {
    swaps,
    activeSwaps,
    historySwaps,
    isLoading,
    refetch,
  };
}
