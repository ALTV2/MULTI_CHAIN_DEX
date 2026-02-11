import type { StoredSwapMeta } from '@/types/swap';

const STORAGE_KEY_PREFIX = 'dex_swaps_';

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
}

/** Match swap by orderId + sourceChainId (unique across chains) */
function matchSwap(s: StoredSwapMeta, orderId: string, sourceChainId?: number): boolean {
  if (s.orderId !== orderId) return false;
  if (sourceChainId !== undefined && s.sourceChainId !== sourceChainId) return false;
  return true;
}

function isValidSwap(s: unknown): s is StoredSwapMeta {
  if (!s || typeof s !== 'object') return false;
  const obj = s as Record<string, unknown>;
  return typeof obj.orderId === 'string' && typeof obj.sourceChainId === 'number';
}

export function getSwaps(walletAddress: string): StoredSwapMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSwap);
  } catch {
    return [];
  }
}

export function getSwap(walletAddress: string, orderId: string, sourceChainId?: number): StoredSwapMeta | undefined {
  return getSwaps(walletAddress).find((s) => matchSwap(s, orderId, sourceChainId));
}

export function saveSwap(walletAddress: string, swap: StoredSwapMeta): void {
  if (typeof window === 'undefined') return;
  const swaps = getSwaps(walletAddress);
  const idx = swaps.findIndex((s) => matchSwap(s, swap.orderId, swap.sourceChainId));
  if (idx >= 0) {
    swaps[idx] = { ...swap, updatedAt: Date.now() };
  } else {
    swaps.push({ ...swap, updatedAt: Date.now() });
  }
  localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(swaps));
}

export function updateSwap(
  walletAddress: string,
  orderId: string,
  updates: Partial<StoredSwapMeta>,
  sourceChainId?: number
): void {
  const existing = getSwap(walletAddress, orderId, sourceChainId);
  if (!existing) return;
  saveSwap(walletAddress, { ...existing, ...updates });
}

export function removeSwap(walletAddress: string, orderId: string, sourceChainId?: number): void {
  if (typeof window === 'undefined') return;
  const swaps = getSwaps(walletAddress).filter((s) => !matchSwap(s, orderId, sourceChainId));
  localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(swaps));
}

export function getSecret(walletAddress: string, orderId: string, sourceChainId?: number): string | undefined {
  return getSwap(walletAddress, orderId, sourceChainId)?.secret;
}
