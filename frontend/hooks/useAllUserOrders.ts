'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { getContractAddress, getSupportedChainIds } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { ORDER_STATUS, ZERO_ADDRESS, HTLC_STATUS_MAP } from '@/lib/constants/swap';
import { fromNumericChainId } from '@/lib/contracts/addresses';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { clearAllSwaps } from '@/lib/utils/swapStorage';
import type { ActiveSwap, SwapPhase } from '@/types/swap';
import { useActiveSwaps } from './useActiveSwaps';
import { useSuiUserOrders } from './useSuiUserOrders';
import { useMyeCrossChainOrders } from './useCrossChainOrders';
import { useSuiSameChainOrders } from './useSuiSameChainOrders';

interface SuiOrderEnrichment {
  phase: SwapPhase;
  creatorHtlcObjectId?: string;
  hashlock?: string;
}

interface SameChainOrder {
  id: bigint;
  chainId: number;
  creator: string;
  tokenToSell: string;
  tokenToBuy: string;
  sellAmount: bigint;
  buyAmount: bigint;
  status: number;
  type: 'same-chain';
}

/**
 * Scan all supported chains for same-chain orders where user is the creator
 */
async function fetchUserSameChainOrders(walletAddress: string): Promise<SameChainOrder[]> {
  const allChainIds = getSupportedChainIds();
  // Filter for EVM chains only (same-chain orders use EVM contracts)
  // Note: Object.keys() always returns strings, so we filter by excluding SUI chains
  const chainIds = allChainIds
    .filter((id) => !String(id).startsWith('sui:'))
    .map((id) => Number(id));
  const allOrders: SameChainOrder[] = [];

  for (const chainId of chainIds) {
    try {
      const client = getPublicClient(chainId);
      const orderBookAddress = getContractAddress(chainId, 'orderBook') as `0x${string}`;

      // Get total number of orders
      const orderCounter = await client.readContract({
        address: orderBookAddress,
        abi: orderBookABI,
        functionName: 'orderCounter',
      }) as bigint;

      if (orderCounter === 0n) continue;

      // Fetch all orders and filter by creator
      const lowerWallet = walletAddress.toLowerCase();

      for (let i = 1n; i <= orderCounter; i++) {
        try {
          const order = await client.readContract({
            address: orderBookAddress,
            abi: orderBookABI,
            functionName: 'getOrder',
            args: [i],
          }) as any;

          // Only include orders created by this user
          if (order.creator.toLowerCase() === lowerWallet) {
            allOrders.push({
              id: order.id,
              chainId,
              creator: order.creator,
              tokenToSell: order.tokenToSell,
              tokenToBuy: order.tokenToBuy,
              sellAmount: order.sellAmount,
              buyAmount: order.buyAmount,
              status: order.status,
              type: 'same-chain',
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch order ${i} on chain ${chainId}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed to scan same-chain orders on chain ${chainId}:`, err);
    }
  }

  return allOrders;
}

/**
 * Unified hook that combines both cross-chain and same-chain orders (EVM + SUI)
 */
export function useAllUserOrders() {
  const { address } = useAccount(); // EVM wallet
  const suiAccount = useCurrentAccount(); // SUI wallet
  const suiClient = useSuiClient();
  const { swaps: crossChainSwaps, isLoading: isCrossChainLoading, refetch: refetchCrossChain } = useActiveSwaps();

  const [lastRefresh, setLastRefresh] = useState(0);

  // Track previous SUI address to detect wallet change
  const prevSuiAddressRef = useRef<string | undefined>();

  // Clear all swap storage when SUI wallet changes
  useEffect(() => {
    const lowerAddr = suiAccount?.address?.toLowerCase();
    if (prevSuiAddressRef.current !== undefined && prevSuiAddressRef.current !== lowerAddr) {
      clearAllSwaps();
    }
    prevSuiAddressRef.current = lowerAddr;
  }, [suiAccount?.address]);

  // Fetch SUI CCOB orders for current SUI wallet (creator + matcher roles)
  const { creatorOrders: suiOrders, matcherOrders: suiMatcherOrders, isLoading: isSuiLoading } = useSuiUserOrders();

  // Fetch SUI same-chain orders (order_book.move)
  const { orders: suiSameChainRaw, isLoading: isSuiSameChainLoading, refetch: refetchSuiSameChain } = useSuiSameChainOrders();

  // Fetch cross-chain orders from both EVM chains via React Query (with retry logic)
  const { orders: sepoliaOrders, isLoading: isSepoliaLoading, refetch: refetchSepolia } = useMyeCrossChainOrders(sepolia.id);
  const { orders: polygonOrders, isLoading: isPolygonLoading, refetch: refetchPolygon } = useMyeCrossChainOrders(polygonAmoy.id);

  // Fetch same-chain EVM orders via React Query so invalidateQueries(['userOrders']) auto-refreshes them
  const {
    data: sameChainOrders = [],
    isLoading: isSameChainLoading,
    refetch: refetchSameChain,
  } = useQuery({
    queryKey: ['userOrders', 'sameChain', address],
    queryFn: () => fetchUserSameChainOrders(address!),
    enabled: false, // Lazy — only fetch on manual refetch()
    staleTime: 30_000,
  });

  const refetch = useCallback(() => {
    refetchCrossChain();
    refetchSepolia();
    refetchPolygon();
    refetchSameChain();
    refetchSuiSameChain();
    setLastRefresh(Date.now());
  }, [refetchCrossChain, refetchSepolia, refetchPolygon, refetchSameChain, refetchSuiSameChain]);

  // Async phase enrichment for SUI→EVM Matched orders.
  // Queries EVM HTLC status + SUI HTLC events from chain so phase is
  // always derived from blockchain (not localStorage flags).
  const [suiEnrichMap, setSuiEnrichMap] = useState<Map<string, SuiOrderEnrichment>>(new Map());

  useEffect(() => {
    const matchedCrossChain = suiOrders.filter(
      (o) => o.status === 'Matched' && o.targetChainId !== 0 && o.matcherHtlcSwapId
    );
    if (matchedCrossChain.length === 0) {
      setSuiEnrichMap(new Map());
      return;
    }

    let cancelled = false;

    const enrich = async () => {
      const htlcPackageId = getContractAddress('sui:testnet', 'htlc') as string;

      // 1. Query all SwapCreated events sent by the connected SUI wallet
      const suiHtlcByHashlock = new Map<string, { objectId: string; status: string }>();
      if (suiAccount?.address) {
        try {
          const events = await suiClient.queryEvents({
            query: { Sender: suiAccount.address },
            limit: 100,
            order: 'descending',
          });
          const htlcEvents = events.data.filter((e) =>
            e.type.includes(`${htlcPackageId}::htlc::SwapCreated`)
          );
          for (const event of htlcEvents) {
            const p = event.parsedJson as any;
            if (!p?.hashlock || !p?.swap_object_id) continue;
            const hashlock = '0x' + (p.hashlock as number[])
              .map((b: number) => b.toString(16).padStart(2, '0')).join('');
            const objectId = String(p.swap_object_id);
            // Read current SUI HTLC status
            let status = 'Active';
            try {
              const obj = await suiClient.getObject({ id: objectId, options: { showContent: true } });
              const statusNum = parseInt((obj.data?.content as any)?.fields?.status ?? '1', 10);
              if (statusNum === 2) status = 'Withdrawn';
              else if (statusNum === 3) status = 'Refunded';
            } catch { /* object may not be readable */ }
            suiHtlcByHashlock.set(hashlock, { objectId, status });
          }
        } catch (err) {
          console.warn('[suiEnrich] Failed to query SUI HTLC events:', err);
        }
      }

      // 2. For each Matched order, query EVM HTLC and determine phase
      const enrichMap = new Map<string, SuiOrderEnrichment>();
      for (const order of matchedCrossChain) {
        try {
          const targetChainId = order.targetChainId as number;
          const evmClient = getPublicClient(targetChainId);
          const htlcAddress = getContractAddress(targetChainId, 'htlc') as `0x${string}`;
          const swapData = await evmClient.readContract({
            address: htlcAddress,
            abi: HTLC_ABI,
            functionName: 'getSwap',
            args: [order.matcherHtlcSwapId as `0x${string}`],
          }) as any;

          const matcherStatus = HTLC_STATUS_MAP[swapData.status as number] || 'Empty';
          const hashlock = swapData.hashlock as string;

          if (matcherStatus === 'Empty' || matcherStatus === 'Refunded') {
            enrichMap.set(order.id, { phase: 'order_matched' });
            continue;
          }

          const creatorHtlc = suiHtlcByHashlock.get(hashlock);
          if (!creatorHtlc) {
            enrichMap.set(order.id, { phase: 'order_matched', hashlock });
          } else if (creatorHtlc.status === 'Active' && matcherStatus === 'Active') {
            enrichMap.set(order.id, { phase: 'matcher_htlc_created', creatorHtlcObjectId: creatorHtlc.objectId, hashlock });
          } else if (creatorHtlc.status === 'Withdrawn' && matcherStatus === 'Active') {
            // Matcher withdrew from SUI (revealed secret), creator hasn't claimed EVM yet
            enrichMap.set(order.id, { phase: 'secret_revealed', creatorHtlcObjectId: creatorHtlc.objectId, hashlock });
          } else if (creatorHtlc.status === 'Withdrawn' && matcherStatus === 'Withdrawn') {
            // Both withdrawn — swap complete
            enrichMap.set(order.id, { phase: 'completed', creatorHtlcObjectId: creatorHtlc.objectId, hashlock });
          } else if (matcherStatus === 'Withdrawn') {
            // Matcher's EVM HTLC withdrawn but no SUI counter-HTLC found — treat as completed
            enrichMap.set(order.id, { phase: 'completed', creatorHtlcObjectId: creatorHtlc?.objectId, hashlock });
          } else {
            enrichMap.set(order.id, { phase: 'order_matched', hashlock });
          }
        } catch (err) {
          console.warn(`[suiEnrich] Failed for order ${order.id}:`, err);
          enrichMap.set(order.id, { phase: 'order_matched' });
        }
      }

      if (!cancelled) setSuiEnrichMap(enrichMap);
    };

    enrich();
    return () => { cancelled = true; };
  }, [suiOrders, suiClient, suiAccount?.address, lastRefresh]);

  // Async phase enrichment for SUI→EVM Matched orders where current wallet is MATCHER.
  // Reads EVM HTLC status and queries the order CREATOR's SUI events to find the counter-HTLC.
  const [suiMatcherEnrichMap, setSuiMatcherEnrichMap] = useState<Map<string, SuiOrderEnrichment>>(new Map());

  useEffect(() => {
    const matchedMatcherOrders = suiMatcherOrders.filter(
      (o) => o.status === 'Matched' && o.targetChainId !== 0 && o.matcherHtlcSwapId
    );
    if (matchedMatcherOrders.length === 0) {
      setSuiMatcherEnrichMap(new Map());
      return;
    }

    let cancelled = false;
    const htlcPackageId = getContractAddress('sui:testnet', 'htlc') as string;

    const enrich = async () => {
      const enrichMap = new Map<string, SuiOrderEnrichment>();

      for (const order of matchedMatcherOrders) {
        try {
          // 1. Read EVM HTLC (locked by this matcher)
          const targetChainId = order.targetChainId as number;
          const evmClient = getPublicClient(targetChainId);
          const htlcAddress = getContractAddress(targetChainId, 'htlc') as `0x${string}`;
          const swapData = await evmClient.readContract({
            address: htlcAddress,
            abi: HTLC_ABI,
            functionName: 'getSwap',
            args: [order.matcherHtlcSwapId as `0x${string}`],
          }) as any;

          const matcherStatus = HTLC_STATUS_MAP[swapData.status as number] || 'Empty';
          const hashlock = swapData.hashlock as string;

          if (matcherStatus === 'Empty' || matcherStatus === 'Refunded') {
            enrichMap.set(order.id, { phase: 'order_matched' });
            continue;
          }

          // 2. Query SUI SwapCreated events from the ORDER CREATOR's address
          let creatorHtlcObjectId: string | undefined;
          let creatorHtlcStatus = 'Empty';
          try {
            const events = await suiClient.queryEvents({
              query: { Sender: order.creator },
              limit: 200,
              order: 'descending',
            });
            const htlcEvents = events.data.filter((e) =>
              e.type.includes(`${htlcPackageId}::htlc::SwapCreated`)
            );
            for (const event of htlcEvents) {
              const p = event.parsedJson as any;
              if (!p?.hashlock || !p?.swap_object_id) continue;
              const evtHashlock = '0x' + (p.hashlock as number[])
                .map((b: number) => b.toString(16).padStart(2, '0')).join('');
              if (evtHashlock.toLowerCase() !== hashlock.toLowerCase()) continue;
              creatorHtlcObjectId = String(p.swap_object_id);
              // Read current status
              try {
                const obj = await suiClient.getObject({ id: creatorHtlcObjectId, options: { showContent: true } });
                const statusNum = parseInt((obj.data?.content as any)?.fields?.status ?? '1', 10);
                if (statusNum === 2) creatorHtlcStatus = 'Withdrawn';
                else if (statusNum === 3) creatorHtlcStatus = 'Refunded';
                else creatorHtlcStatus = 'Active';
              } catch { /* use default */ }
              break;
            }
          } catch (err) {
            console.warn(`[suiMatcherEnrich] Failed to query SUI events for creator ${order.creator}:`, err);
          }

          // 3. Determine phase
          if (!creatorHtlcObjectId || creatorHtlcStatus === 'Empty') {
            // Matcher locked EVM HTLC but creator hasn't created SUI counter-HTLC yet
            enrichMap.set(order.id, { phase: 'order_matched', hashlock });
          } else if (creatorHtlcStatus === 'Active' && matcherStatus === 'Active') {
            // Both HTLCs are locked — matcher can withdraw from SUI HTLC
            enrichMap.set(order.id, { phase: 'matcher_htlc_created', creatorHtlcObjectId, hashlock });
          } else if (creatorHtlcStatus === 'Withdrawn' && matcherStatus === 'Withdrawn') {
            // Both withdrawn — swap complete
            enrichMap.set(order.id, { phase: 'completed', creatorHtlcObjectId, hashlock });
          } else if (creatorHtlcStatus === 'Withdrawn' && matcherStatus === 'Active') {
            // Matcher withdrew from SUI HTLC, creator hasn't claimed EVM yet
            enrichMap.set(order.id, { phase: 'secret_revealed', creatorHtlcObjectId, hashlock });
          } else if (matcherStatus === 'Withdrawn') {
            enrichMap.set(order.id, { phase: 'completed', creatorHtlcObjectId, hashlock });
          } else {
            enrichMap.set(order.id, { phase: 'order_matched', hashlock });
          }
        } catch (err) {
          console.warn(`[suiMatcherEnrich] Failed for order ${order.id}:`, err);
          enrichMap.set(order.id, { phase: 'order_matched' });
        }
      }

      if (!cancelled) setSuiMatcherEnrichMap(enrichMap);
    };

    enrich();
    return () => { cancelled = true; };
  }, [suiMatcherOrders, suiClient, lastRefresh]);

  // Convert same-chain orders to ActiveSwap format for unified display
  const sameChainAsSwaps = useMemo<ActiveSwap[]>(() => {
    return sameChainOrders.map((order) => {
      let phase: SwapPhase = 'order_created';

      if (order.status === ORDER_STATUS.COMPLETED) {
        phase = 'completed';
      } else if (order.status === ORDER_STATUS.CANCELLED) {
        phase = 'refunded';
      }

      return {
        meta: {
          orderId: order.id.toString(),
          role: 'creator' as const,
          sourceChainId: order.chainId,
          targetChainId: order.chainId, // Same chain
          hashlock: '',
          sellToken: order.tokenToSell,
          sellAmount: order.sellAmount.toString(),
          buyToken: order.tokenToBuy,
          buyAmount: order.buyAmount.toString(),
          creator: order.creator,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        phase,
        orderStatus: order.status === ORDER_STATUS.ACTIVE ? 'Active' : order.status === ORDER_STATUS.COMPLETED ? 'Completed' : 'Cancelled',
      };
    });
  }, [sameChainOrders]);

  // Convert SUI orders to ActiveSwap format
  const suiOrdersAsSwaps = useMemo<ActiveSwap[]>(() => {
    return suiOrders.map((order) => {
      let phase: SwapPhase = 'order_created';
      let orderStatus = 'Active';

      if (order.status === 'Completed') {
        phase = 'completed';
        orderStatus = 'Completed';
      } else if (order.status === 'Cancelled') {
        phase = 'refunded';
        orderStatus = 'Cancelled';
      } else if (order.status === 'Matched') {
        const isCrossChainOrder = order.targetChainId !== 0;
        orderStatus = 'Matched';
        if (isCrossChainOrder) {
          // Use on-chain enriched phase if available, otherwise default to order_matched
          phase = suiEnrichMap.get(order.id)?.phase ?? 'order_matched';
        } else {
          phase = 'creator_htlc_created';
        }
      }

      const isCrossChain = order.targetChainId !== 0;
      const enrichment = isCrossChain ? suiEnrichMap.get(order.id) : undefined;

      return {
        meta: {
          orderId: `sui-${order.id}`,
          role: 'creator' as const,
          sourceChainId: 'sui:testnet',
          targetChainId: isCrossChain ? order.targetChainId : 'sui:testnet',
          hashlock: enrichment?.hashlock ?? '',
          sellToken: order.sellToken,
          sellAmount: order.sellAmount.toString(),
          buyToken: order.buyToken,
          buyAmount: order.buyAmount.toString(),
          creator: order.creator,
          matcher: order.matchedBy,
          matcherHtlcSwapId: order.matcherHtlcSwapId,
          creatorHtlcObjectId: enrichment?.creatorHtlcObjectId,
          targetAddress: order.targetAddress,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        phase,
        orderStatus,
        expiresAt: order.expiresAt,
      };
    });
  }, [suiOrders, suiEnrichMap]);

  // Convert SUI orders where this wallet is the MATCHER (matched_by = suiAddress).
  // These appear from chain without localStorage so they survive wallet switches.
  const suiMatcherOrdersAsSwaps = useMemo<ActiveSwap[]>(() => {
    return suiMatcherOrders.map((order) => {
      const isCrossChain = order.targetChainId !== 0;
      const enrichment = isCrossChain ? suiMatcherEnrichMap.get(order.id) : undefined;

      // Phase from matcher-specific enrichment (queries creator's SUI events)
      let phase: SwapPhase = 'order_matched'; // Matcher always sees matched+ phases
      let orderStatus = 'Matched';
      if (order.status === 'Completed') { phase = 'completed'; orderStatus = 'Completed'; }
      else if (order.status === 'Cancelled') { phase = 'refunded'; orderStatus = 'Cancelled'; }
      else if (enrichment) { phase = enrichment.phase; }

      return {
        meta: {
          orderId: `sui-${order.id}`,
          role: 'matcher' as const,
          sourceChainId: 'sui:testnet',
          targetChainId: isCrossChain ? order.targetChainId : 'sui:testnet',
          hashlock: enrichment?.hashlock ?? '',
          sellToken: order.sellToken,
          sellAmount: order.sellAmount.toString(),
          buyToken: order.buyToken,
          buyAmount: order.buyAmount.toString(),
          creator: order.creator,
          matcher: order.matchedBy,
          matcherHtlcSwapId: order.matcherHtlcSwapId,
          creatorHtlcObjectId: enrichment?.creatorHtlcObjectId,
          targetAddress: order.targetAddress,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        phase,
        orderStatus,
        expiresAt: order.expiresAt,
      };
    });
  }, [suiMatcherOrders, suiMatcherEnrichMap]);

  // Convert directly-fetched cross-chain orders into ActiveSwap format.
  // Only include orders NOT already present in crossChainSwaps (from localStorage/scan),
  // so we don't show duplicates. This catches orders that weren't saved to localStorage.
  const crossChainDirectAsSwaps = useMemo<ActiveSwap[]>(() => {
    const localKeys = new Set(
      crossChainSwaps.map((s) => `${s.meta.sourceChainId}-${s.meta.orderId}`)
    );

    const combined = [
      ...sepoliaOrders.map((o) => ({ order: o, chainId: sepolia.id })),
      ...polygonOrders.map((o) => ({ order: o, chainId: polygonAmoy.id })),
    ];

    const filtered = combined.filter(({ order, chainId }) => !localKeys.has(`${chainId}-${order.id.toString()}`));

    return filtered
      .map(({ order, chainId }) => {
        const hasMatch = order.matchedBy !== ZERO_ADDRESS;
        return {
          meta: {
            orderId: order.id.toString(),
            role: 'creator' as const,
            sourceChainId: chainId,
            targetChainId: fromNumericChainId(Number(order.targetChainId)),
            hashlock: '',
            sellToken: order.sellToken,
            sellAmount: order.sellAmount.toString(),
            buyToken: order.buyToken,
            buyAmount: order.buyAmount.toString(),
            creator: order.creator,
            matcher: hasMatch ? order.matchedBy : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          phase: (hasMatch ? 'order_matched' : 'order_created') as SwapPhase,
          orderStatus: order.status, // Already a readable string: 'Active', 'Matched', etc.
          expiresAt: order.expiresAt,
        };
      });
  }, [crossChainSwaps, sepoliaOrders, polygonOrders]);

  // Convert SUI same-chain orders (order_book.move) to ActiveSwap format
  const suiSameChainAsSwaps = useMemo<ActiveSwap[]>(() => {
    if (!suiAccount?.address) return [];
    const userAddr = suiAccount.address.toLowerCase();

    return suiSameChainRaw
      .filter((o) => o.creator.toLowerCase() === userAddr)
      .map((o) => {
        let phase: SwapPhase = 'order_created';
        let orderStatus = 'Active';

        if (o.status === 'Filled') {
          phase = 'completed';
          orderStatus = 'Completed';
        } else if (o.status === 'Cancelled') {
          phase = 'refunded';
          orderStatus = 'Cancelled';
        }

        return {
          meta: {
            orderId: `sui-sc-${o.orderId}`,
            role: 'creator' as const,
            sourceChainId: 'sui:testnet',
            targetChainId: 'sui:testnet',
            hashlock: '',
            sellToken: o.pairConfig.coinAType,
            sellAmount: o.sellAmount.toString(),
            buyToken: o.pairConfig.coinBType,
            buyAmount: o.buyAmount.toString(),
            creator: o.creator,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          phase,
          orderStatus,
        };
      });
  }, [suiSameChainRaw, suiAccount?.address]);

  // Merge cross-chain, same-chain, and SUI orders.
  // Dedup by (sourceChainId, targetChainId, orderId): includes targetChainId because
  // same-chain orderBook and cross-chain CCOB are separate contracts with independent ID spaces.
  // Blockchain-sourced SUI entries take priority over localStorage copies.
  const allSwaps = useMemo(() => {
    const seen = new Map<string, ActiveSwap>();

    // Validate chain IDs — filter out swaps with unsupported chain 0
    const isValidChain = (id: number | string) => id !== 0 && id !== '0';

    // Insert in priority order: blockchain SUI sources first, then localStorage/direct
    const insertAll = (swaps: ActiveSwap[], overwrite: boolean) => {
      for (const swap of swaps) {
        if (!isValidChain(swap.meta.sourceChainId) || !isValidChain(swap.meta.targetChainId)) continue;
        const key = `${String(swap.meta.sourceChainId)}-${String(swap.meta.targetChainId)}-${swap.meta.orderId}`;
        if (overwrite || !seen.has(key)) {
          seen.set(key, swap);
        }
      }
    };

    // SUI blockchain entries take highest priority (from on-chain queries)
    insertAll(suiOrdersAsSwaps, true);
    insertAll(suiMatcherOrdersAsSwaps, false);
    insertAll(suiSameChainAsSwaps, false);
    // EVM entries (localStorage + direct) fill in the rest
    insertAll(crossChainSwaps, false);
    insertAll(crossChainDirectAsSwaps, false);
    insertAll(sameChainAsSwaps, false);

    return Array.from(seen.values());
  }, [crossChainSwaps, crossChainDirectAsSwaps, sameChainAsSwaps, suiOrdersAsSwaps, suiMatcherOrdersAsSwaps, suiSameChainAsSwaps]);

  const activeSwaps = useMemo(
    () => {
      const now = BigInt(Math.floor(Date.now() / 1000));

      const result = allSwaps.filter((s) => {
        // Exclude completed/refunded/refundable phases
        if (['completed', 'refunded', 'refundable'].includes(s.phase)) return false;

        // Exclude cancelled, expired, or completed orders at the blockchain level
        if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) return false;

        // For cross-chain orders with expiresAt, exclude if time has passed
        if (s.expiresAt && s.expiresAt <= now) return false;

        return true;
      });
      return result;
    },
    [allSwaps]
  );

  const historySwaps = useMemo(
    () => {
      const now = BigInt(Math.floor(Date.now() / 1000));

      return allSwaps.filter((s) => {
        // Include completed/refunded/refundable phases
        if (['completed', 'refunded', 'refundable'].includes(s.phase)) return true;

        // Include cancelled, expired, or completed orders
        if (s.orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(s.orderStatus)) {
          return true;
        }

        // Include locally expired orders
        if (s.expiresAt && s.expiresAt <= now) {
          return true;
        }

        return false;
      });
    },
    [allSwaps]
  );

  const isLoading = isCrossChainLoading || isSameChainLoading || isSuiLoading || isSuiSameChainLoading || isSepoliaLoading || isPolygonLoading;

  return {
    swaps: allSwaps,
    activeSwaps,
    historySwaps,
    isLoading,
    refetch,
    // Separate counts for debugging/stats
    crossChainCount: crossChainSwaps.length + sepoliaOrders.length + polygonOrders.length,
    sameChainCount: sameChainOrders.length,
    suiCount: suiOrders.length,
  };
}
