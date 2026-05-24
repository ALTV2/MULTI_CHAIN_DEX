'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  fetchChains, fetchTokens, fetchOrders, fetchMyOrders,
  fetchActiveSwaps, fetchSwapHistory, notifyTransaction,
  attachOrderMetadata,
  type ChainDto, type TokenDto, type OrderDto, type SwapDto, type PageDto,
} from '@/lib/api/dexApi';

// ── Wallet helper ─────────────────────────────────────────────────────

/** Collect all connected wallet addresses (EVM + SUI). */
export function useWallets(): string[] {
  const { address: evmAddress } = useAccount();
  const suiAccount = useCurrentAccount();
  const wallets: string[] = [];
  if (evmAddress) wallets.push(evmAddress);
  if (suiAccount?.address) wallets.push(suiAccount.address);
  return wallets;
}

// ── Reference data ────────────────────────────────────────────────────

export function useChains() {
  return useQuery<ChainDto[]>({
    queryKey: ['dex', 'chains'],
    queryFn: fetchChains,
    staleTime: 5 * 60 * 1000, // chains rarely change
  });
}

export function useTokens(chainId?: string) {
  return useQuery<TokenDto[]>({
    queryKey: ['dex', 'tokens', chainId],
    queryFn: () => fetchTokens(chainId),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Order book ────────────────────────────────────────────────────────

export function useOrderBook(params: {
  status?: string;
  sourceChain?: string;
  targetChain?: string;
  orderType?: string;
  sellToken?: string;
  buyToken?: string;
  page?: number;
  size?: number;
} = {}) {
  return useQuery<PageDto<OrderDto>>({
    queryKey: ['dex', 'orders', params],
    queryFn: () => fetchOrders(params),
    staleTime: 30_000,
  });
}

// ── My orders ─────────────────────────────────────────────────────────

export function useMyOrders(params: {
  status?: string;
  role?: string;
  page?: number;
  size?: number;
} = {}) {
  const wallets = useWallets();
  return useQuery<PageDto<OrderDto>>({
    queryKey: ['dex', 'myOrders', wallets, params],
    queryFn: () => fetchMyOrders({ wallets, ...params }),
    enabled: wallets.length > 0,
    staleTime: 15_000,
  });
}

// ── Active swaps ──────────────────────────────────────────────────────

export function useActiveSwaps() {
  const wallets = useWallets();
  return useQuery<SwapDto[]>({
    queryKey: ['dex', 'activeSwaps', wallets],
    queryFn: () => fetchActiveSwaps(wallets),
    enabled: wallets.length > 0,
    staleTime: 10_000,
  });
}

// ── Swap history ──────────────────────────────────────────────────────

export function useSwapHistory(page = 0, size = 20) {
  const wallets = useWallets();
  return useQuery<PageDto<SwapDto>>({
    queryKey: ['dex', 'swapHistory', wallets, page, size],
    queryFn: () => fetchSwapHistory({ wallets, page, size }),
    enabled: wallets.length > 0,
    staleTime: 30_000,
  });
}

// ── Tx notification ───────────────────────────────────────────────────

/**
 * Hook to notify the backend about a new transaction.
 * After notification, invalidates relevant queries so UI updates.
 */
export function useTxNotify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notifyTransaction,
    onSuccess: () => {
      // Give indexer a moment to process, then invalidate
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dex', 'orders'] });
        queryClient.invalidateQueries({ queryKey: ['dex', 'myOrders'] });
        queryClient.invalidateQueries({ queryKey: ['dex', 'activeSwaps'] });
        queryClient.invalidateQueries({ queryKey: ['dex', 'swapHistory'] });
      }, 2000);
    },
  });
}

/**
 * Convenience: call after any blockchain write to keep UI in sync.
 */
export function useRefreshDexData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['dex'] });
  };
}

// ── Order metadata (off-chain) ────────────────────────────────────────

/**
 * Hook for attaching off-chain order metadata (full target address + opt-in email).
 * On success, invalidates order/swap caches so the UI picks up the new fields.
 */
export function useAttachOrderMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: attachOrderMetadata,
    onSuccess: (ok) => {
      if (!ok) return;
      queryClient.invalidateQueries({ queryKey: ['dex', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['dex', 'myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['dex', 'activeSwaps'] });
      queryClient.invalidateQueries({ queryKey: ['dex', 'swapHistory'] });
    },
  });
}
