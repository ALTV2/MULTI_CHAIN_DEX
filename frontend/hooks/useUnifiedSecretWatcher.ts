'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSuiSecretWatcher } from './useSuiHTLC';

/**
 * Unified secret watcher.
 * - SUI chains: uses on-chain SUI event watcher (useSuiSecretWatcher)
 * - EVM chains: secret now comes from backend API (revealedSecret in SwapResponse),
 *   so this hook returns null for EVM. The component should check swap.revealedSecret instead.
 */
export function useUnifiedSecretWatcher(
  chainId: number | string,
  swapId: `0x${string}` | undefined,
  enabled: boolean = true
) {
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const isSuiChain = typeof chainId === 'string';

  // SUI secret watcher (direct on-chain — SUI dapp-kit, not Alchemy)
  const handleSuiSecret = useCallback((revealedSecret: `0x${string}`) => {
    setSecret(revealedSecret);
  }, []);

  const { isWatching: isSuiWatching } = useSuiSecretWatcher(
    enabled && isSuiChain ? swapId : undefined,
    handleSuiSecret
  );

  // Clear on swap change
  useEffect(() => { setSecret(null); }, [swapId]);

  return {
    secret,
    isLoading: isSuiChain ? isSuiWatching : false,
    error: null as string | null,
    refetch: () => {},
    chainType: isSuiChain ? 'sui' as const : 'evm' as const,
  };
}
