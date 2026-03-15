import type { StoredSwapMeta } from '@/types/swap';

const STORAGE_KEY_PREFIX = 'dex_swaps_';

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
}

/** Match swap by orderId + sourceChainId (unique across chains) */
function matchSwap(s: StoredSwapMeta, orderId: string, sourceChainId?: number | string): boolean {
  if (s.orderId !== orderId) return false;
  if (sourceChainId !== undefined && s.sourceChainId !== sourceChainId) return false;
  return true;
}

function isValidSwap(s: unknown): s is StoredSwapMeta {
  if (!s || typeof s !== 'object') return false;
  const obj = s as Record<string, unknown>;

  // Basic type checks - sourceChainId and targetChainId can be number (EVM) or string (SUI)
  if (typeof obj.orderId !== 'string' ||
      (typeof obj.sourceChainId !== 'number' && typeof obj.sourceChainId !== 'string')) {
    return false;
  }

  // ⚠️ IMPORTANT: Filter out fake orders with timestamp IDs
  // Real order IDs are sequential (1, 2, 3, ...), not timestamps (1771171412...)
  const orderIdNum = parseInt(obj.orderId);
  if (orderIdNum > 1000000000) {
    console.warn(`🗑️ Removing fake order with timestamp ID: ${obj.orderId}`);
    return false;
  }

  return true;
}

export function getSwaps(walletAddress: string): StoredSwapMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(walletAddress);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validSwaps = parsed.filter(isValidSwap);

    // Auto-cleanup: If we filtered out any invalid swaps, save the cleaned version
    if (validSwaps.length !== parsed.length) {
      console.log(`🧹 Auto-cleanup: Removed ${parsed.length - validSwaps.length} invalid swap(s) from localStorage`);
      localStorage.setItem(key, JSON.stringify(validSwaps));
    }

    return validSwaps;
  } catch {
    return [];
  }
}

export function getSwap(walletAddress: string, orderId: string, sourceChainId?: number | string): StoredSwapMeta | undefined {
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
  sourceChainId?: number | string
): void {
  const existing = getSwap(walletAddress, orderId, sourceChainId);
  if (!existing) return;
  saveSwap(walletAddress, { ...existing, ...updates });
}

export function removeSwap(walletAddress: string, orderId: string, sourceChainId?: number | string): void {
  if (typeof window === 'undefined') return;
  const swaps = getSwaps(walletAddress).filter((s) => !matchSwap(s, orderId, sourceChainId));
  localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(swaps));
}

export function getSecret(walletAddress: string, orderId: string, sourceChainId?: number | string): string | undefined {
  return getSwap(walletAddress, orderId, sourceChainId)?.secret;
}

/**
 * Clean up all fake orders with timestamp IDs from ALL storage keys
 * This runs once to remove legacy fake orders
 */
export function cleanupAllFakeOrders(): void {
  if (typeof window === 'undefined') return;

  try {
    let totalCleaned = 0;
    const keys = Object.keys(localStorage);

    // Find all swap storage keys (both old "swaps_" and new "dex_swaps_")
    const swapKeys = keys.filter(k => k.startsWith('swaps_') || k.startsWith('dex_swaps_'));

    swapKeys.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        const cleaned = parsed.filter(swap => {
          if (!swap || typeof swap !== 'object') return false;
          const orderId = (swap as any).orderId;
          if (typeof orderId !== 'string') return false;

          // Remove orders with timestamp IDs (> 1000000000)
          if (parseInt(orderId) > 1000000000) {
            totalCleaned++;
            return false;
          }
          return true;
        });

        if (cleaned.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(cleaned));
          console.log(`🧹 Cleaned ${parsed.length - cleaned.length} fake order(s) from ${key}`);
        }
      } catch (e) {
        console.error(`Failed to clean ${key}:`, e);
      }
    });

    if (totalCleaned > 0) {
      console.log(`✅ Cleanup complete: Removed ${totalCleaned} fake order(s) total`);
    }
  } catch (e) {
    console.error('Cleanup failed:', e);
  }
}
