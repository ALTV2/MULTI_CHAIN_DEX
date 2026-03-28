'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { getContractAddress, getSupportedChainIds, fromNumericChainId } from '@/lib/contracts/addresses';
import { getSwaps, getSwap, saveSwap, updateSwap, cleanupAllFakeOrders, clearWalletSwaps } from '@/lib/utils/swapStorage';
import { determineSwapPhase } from '@/lib/utils/swapPhase';
import { getPublicClient } from '@/lib/utils/rpcClient';
import type { StoredSwapMeta, ActiveSwap } from '@/types/swap';
import {
  HTLC_STATUS_MAP,
  ORDER_STATUS_MAP,
  SWAP_SCAN_COOLDOWN_MS,
  AUTO_REFRESH_INTERVAL_MS,
  ZERO_ADDRESS,
} from '@/lib/constants/swap';

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
    // Skip non-EVM chains (this function scans EVM contracts only)
    // Note: Object.keys() always returns strings, so check by value not typeof
    if (String(chainId).startsWith('sui:')) continue;
    const chainIdNum = Number(chainId);

    try {
      const client = getPublicClient(chainIdNum);
      const ccobAddress = getContractAddress(chainIdNum, 'crossChainOrderBook') as `0x${string}`;

      // 1. Find orders where user is creator (using getOrdersByCreator)
      try {
        const creatorOrders = await client.readContract({
          address: ccobAddress,
          abi: CROSS_CHAIN_ORDER_BOOK_ABI,
          functionName: 'getOrdersByCreator',
          args: [walletAddress as `0x${string}`],
        }) as any[];


        for (const order of creatorOrders) {
          const orderId = order.id.toString();

          // ⚠️ IMPORTANT: Verify that the wallet is actually the creator
          // This prevents saving matched orders with incorrect role
          if (order.creator.toLowerCase() !== lowerWallet) {
            continue;
          }

          const existing = getSwap(walletAddress, orderId, chainIdNum);

          if (existing) {
            // Update matcher if discovered on-chain but missing locally
            const matchedBy = order.matchedBy as string;
            if (matchedBy && matchedBy !== ZERO_ADDRESS && !existing.matcher) {
              updateSwap(walletAddress, orderId, { matcher: matchedBy }, chainIdNum);
            }
            continue;
          }

          const matchedBy = order.matchedBy as string;
          const meta: StoredSwapMeta = {
            orderId,
            role: 'creator',
            sourceChainId: chainIdNum,
            targetChainId: fromNumericChainId(Number(order.targetChainId)),
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


        // Contract uses 1-based IDs (order IDs go from 1 to totalOrders)
        for (let i = 1; i <= Number(totalOrders); i++) {
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

            const existing = getSwap(walletAddress, orderId, chainIdNum);
            if (existing) {
              // Sync creator/matcher if missing
              if (!existing.creator && order.creator) {
                updateSwap(walletAddress, orderId, { creator: order.creator }, chainIdNum);
              }
              continue;
            }

            const resolvedTargetChainId = fromNumericChainId(Number(order.targetChainId));
            const meta: StoredSwapMeta = {
              orderId,
              role: 'matcher',
              sourceChainId: chainIdNum,
              targetChainId: resolvedTargetChainId,
              hashlock: '',
              sellToken: order.sellToken,
              sellAmount: order.sellAmount.toString(),
              buyToken: order.buyToken,
              buyAmount: order.buyAmount.toString(),
              creator: order.creator,
              matcher: walletAddress,
              targetAddress: order.targetAddress,
              creatorSuiAddress: typeof resolvedTargetChainId === 'string' ? order.targetAddress : undefined,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            saveSwap(walletAddress, meta);
            discovered++;
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

  return discovered;
}

/**
 * Discover a user's HTLC swap ID by scanning getSwapsAsInitiator on the HTLC contract.
 * Matches by participant address and optionally by hashlock.
 * When no hashlock filter: prefers Active non-expired HTLCs over old expired ones.
 */
async function discoverHTLCSwap(
  client: ReturnType<typeof getPublicClient>,
  chainId: number,
  initiator: string,
  participant: string,
  matchHashlock?: string
): Promise<{ swapId: string; hashlock: string; status: string; timelock: bigint } | null> {
  try {
    const htlcAddress = getContractAddress(chainId, 'htlc') as `0x${string}`;
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

        const status = HTLC_STATUS_MAP[swapData.status] || 'Empty';
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
  // SUI source (SUI→EVM): the matcher's EVM HTLC can be queried on the EVM target chain.
  // We no longer rely on localStorage flags for phase determination.
  const isSuiSource = typeof meta.sourceChainId === 'string' && meta.sourceChainId.startsWith('sui:');
  if (isSuiSource) {
    let matcherHtlcStatus: string | undefined;
    let matcherHtlcTimelock: bigint | undefined;

    if (meta.matcherHtlcSwapId && typeof meta.targetChainId === 'number') {
      try {
        const evmClient = getPublicClient(meta.targetChainId);
        const htlcAddress = getContractAddress(meta.targetChainId, 'htlc') as `0x${string}`;
        const swapData = await evmClient.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [meta.matcherHtlcSwapId as `0x${string}`],
        }) as any;
        matcherHtlcStatus = HTLC_STATUS_MAP[swapData.status] || 'Empty';
        matcherHtlcTimelock = swapData.timelock as bigint;
        // Sync hashlock from EVM HTLC so determineSwapPhase has it
        if (swapData.hashlock && swapData.hashlock !== meta.hashlock) {
          updateSwap(walletAddress, meta.orderId, { hashlock: swapData.hashlock }, meta.sourceChainId);
          meta = { ...meta, hashlock: swapData.hashlock };
        }
      } catch (err) {
        console.warn('[fetchSwapOnChainData] SUI source: failed to read EVM HTLC:', err);
      }
    }

    return {
      meta,
      phase: determineSwapPhase({ meta, matcherHtlcStatus, matcherHtlcTimelock }),
    };
  }

  try {
    const sourceClient = getPublicClient(meta.sourceChainId as number);
    // Target may be SUI for EVM→SUI swaps; only create EVM client for EVM targets
    const isSuiTarget = typeof meta.targetChainId === 'string' && meta.targetChainId.startsWith('sui:');
    const targetClient = isSuiTarget ? null : getPublicClient(meta.targetChainId as number);
    const updates: Partial<StoredSwapMeta> = {};

    // Step 1: Fetch CCOB order status from source chain, sync matcher
    const ccobAddress = getContractAddress(meta.sourceChainId, 'crossChainOrderBook') as `0x${string}`;
    let orderStatus: string | undefined;
    let expiresAt: bigint | undefined;

    try {
      const orderData = await sourceClient.readContract({
        address: ccobAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'getOrder',
        args: [BigInt(meta.orderId)],
      }) as any;
      orderStatus = ORDER_STATUS_MAP[orderData.status] || 'Active';
      expiresAt = orderData.expiresAt as bigint;

      const matchedBy = orderData.matchedBy as string;
      if (matchedBy && matchedBy !== ZERO_ADDRESS && !meta.matcher) {
        updates.matcher = matchedBy;
        meta = { ...meta, matcher: matchedBy };
      }
    } catch (err) {
      console.error(`[fetchSwapOnChainData] Failed to fetch order ${meta.orderId} status:`, err);
      // Order might not exist or RPC error
    }

    // Step 2: Discover creator's HTLC on source chain if not known
    let creatorHtlcStatus: string | undefined;
    let creatorHtlcTimelock: bigint | undefined;

    if (!meta.creatorHtlcSwapId && meta.creator && meta.matcher) {
      // Scan on-chain: creator created an HTLC on source chain with matcher as participant
      const hashlockFilter = meta.hashlock || undefined;
      const found = await discoverHTLCSwap(
        sourceClient, meta.sourceChainId as number,
        meta.creator, meta.matcher,
        hashlockFilter
      );
      if (found) {
        // When no hashlock filter was used, skip expired HTLCs to avoid matching
        // old swaps from previous interactions between the same addresses
        const isExpired = found.timelock <= BigInt(Math.floor(Date.now() / 1000));
        if (hashlockFilter || !isExpired) {
          updates.creatorHtlcSwapId = found.swapId;
          meta = { ...meta, creatorHtlcSwapId: found.swapId };
          creatorHtlcStatus = found.status;
          creatorHtlcTimelock = found.timelock;
          // ALWAYS sync hashlock from creator's HTLC (overwrite if different)
          if (found.hashlock && found.hashlock !== meta.hashlock) {
            updates.hashlock = found.hashlock;
            meta = { ...meta, hashlock: found.hashlock };
          }
        }
      }
    }

    // Fetch creator HTLC status if we have the swap ID (and didn't already fetch via discovery)
    if (meta.creatorHtlcSwapId && !creatorHtlcStatus) {
      try {
        const htlcAddress = getContractAddress(meta.sourceChainId, 'htlc') as `0x${string}`;
        const swapData = await sourceClient.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [meta.creatorHtlcSwapId as `0x${string}`],
        }) as any;
        creatorHtlcStatus = HTLC_STATUS_MAP[swapData.status] || 'Empty';
        creatorHtlcTimelock = swapData.timelock;
        // ALWAYS sync hashlock from creator's HTLC (overwrite if different)
        if (swapData.hashlock && swapData.hashlock !== meta.hashlock) {
          updates.hashlock = swapData.hashlock;
          meta = { ...meta, hashlock: swapData.hashlock };
        }
      } catch {
        // HTLC might not exist
      }
    }

    // Step 3: Discover matcher's HTLC on target chain if not known (EVM target only)
    let matcherHtlcStatus: string | undefined;
    let matcherHtlcTimelock: bigint | undefined;

    if (targetClient) {
      if (!meta.matcherHtlcSwapId && meta.matcher && meta.creator && meta.hashlock) {
        // Scan on-chain: matcher created an HTLC on target chain with creator as participant, same hashlock
        const found = await discoverHTLCSwap(
          targetClient, meta.targetChainId as number,
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
      if (meta.matcherHtlcSwapId && !matcherHtlcStatus && targetClient) {
        try {
          const htlcAddress = getContractAddress(meta.targetChainId, 'htlc') as `0x${string}`;
          const swapData = await targetClient.readContract({
            address: htlcAddress,
            abi: HTLC_ABI,
            functionName: 'getSwap',
            args: [meta.matcherHtlcSwapId as `0x${string}`],
          }) as any;
          matcherHtlcStatus = HTLC_STATUS_MAP[swapData.status] || 'Empty';
          matcherHtlcTimelock = swapData.timelock;
        } catch {
          // HTLC might not exist
        }
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
      expiresAt,
      creatorHtlcStatus,
      matcherHtlcStatus,
      creatorHtlcTimelock,
      matcherHtlcTimelock,
    };
  } catch (err) {
    console.error(`[fetchSwapOnChainData] Critical error for order ${meta.orderId}:`, err);
    // Fallback: Try to fetch just the order status (minimal RPC call, EVM only)
    let fallbackStatus: string | undefined;
    let fallbackExpiresAt: bigint | undefined;
    if (typeof meta.sourceChainId === 'number') {
      try {
        const sourceClient = getPublicClient(meta.sourceChainId);
        const ccobAddress = getContractAddress(meta.sourceChainId, 'crossChainOrderBook') as `0x${string}`;
        const orderData = await sourceClient.readContract({
          address: ccobAddress,
          abi: CROSS_CHAIN_ORDER_BOOK_ABI,
          functionName: 'getOrder',
          args: [BigInt(meta.orderId)],
        }) as any;
        fallbackStatus = ORDER_STATUS_MAP[orderData.status] || 'Active';
        fallbackExpiresAt = orderData.expiresAt as bigint;
      } catch {
        fallbackStatus = 'Active'; // Assume active if we can't fetch
      }
    }

    return {
      meta,
      phase: determineSwapPhase({ meta }),
      orderStatus: fallbackStatus,
      expiresAt: fallbackExpiresAt,
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
  const cleanupDone = useRef(false); // Track if we've run cleanup
  const prevAddressRef = useRef<string | undefined>();

  // Clear only the PREVIOUS wallet's swap storage on wallet switch, then auto-refetch
  useEffect(() => {
    const lowerAddr = address?.toLowerCase();
    if (prevAddressRef.current !== undefined && prevAddressRef.current !== lowerAddr) {
      if (prevAddressRef.current) clearWalletSwaps(prevAddressRef.current);
      setSwaps([]);
      forceNextScan.current = true;
      // Auto-refetch for the new wallet
      setLastRefresh(Date.now());
    }
    prevAddressRef.current = lowerAddr;
  }, [address]);

  const fetchAll = useCallback(async () => {
    if (!address) {
      setSwaps([]);
      return;
    }

    setIsLoading(true);

    try {
      // Run cleanup once on first load to remove fake orders
      if (!cleanupDone.current) {
        cleanupAllFakeOrders();
        cleanupDone.current = true;
      }

      // Run blockchain scan if: first load, forced, or 30+ seconds since last scan
      const now = Date.now();
      const shouldScan = forceNextScan.current || (now - lastScanTime.current > SWAP_SCAN_COOLDOWN_MS);

      if (shouldScan) {
        try {
          await scanBlockchainForSwaps(address);
          lastScanTime.current = now;
          forceNextScan.current = false;
        } catch (err) {
          console.error('Blockchain scan failed:', err);
        }
      }

      const stored = getSwaps(address);

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

  // Fetch on mount and on manual refresh
  useEffect(() => {
    fetchAll();
  }, [fetchAll, lastRefresh]);

  // Auto-refresh disabled — use manual refresh button only

  const refetch = useCallback(() => {
    forceNextScan.current = true; // Force scan on manual refresh
    setLastRefresh(Date.now());
  }, []);

  const activeSwaps = useMemo(
    () => {
      const filtered = swaps.filter((s) => {
        if (['completed', 'refunded'].includes(s.phase)) return false;
        if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) return false;
        return true;
      });
      return filtered;
    },
    [swaps]
  );

  const historySwaps = useMemo(
    () => swaps.filter((s) => {
      // Include completed/refunded phases
      if (['completed', 'refunded'].includes(s.phase)) return true;

      // Include cancelled, expired, or completed orders
      if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) {
        return true;
      }

      return false;
    }),
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
