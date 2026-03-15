'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSwapSecretFromEvent } from './useSwapSecretFromEvent';
import { useSuiSecretWatcher } from './useSuiHTLC';

/**
 * Unified secret watcher that works with both EVM and SUI chains
 * Automatically detects chain type and uses appropriate watcher
 */
export function useUnifiedSecretWatcher(
  chainId: number | string,
  swapId: `0x${string}` | undefined,
  enabled: boolean = true
) {
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const isSuiChain = typeof chainId === 'string';

  // EVM secret watcher
  const evmWatcher = useSwapSecretFromEvent(
    typeof chainId === 'number' ? chainId : 0,
    swapId,
    enabled && !isSuiChain
  );

  // SUI secret watcher
  const handleSuiSecret = useCallback((revealedSecret: `0x${string}`) => {
    setSecret(revealedSecret);
  }, []);

  const { isWatching: isSuiWatching, error: suiError } = useSuiSecretWatcher(
    enabled && isSuiChain ? swapId : undefined,
    handleSuiSecret
  );

  // Update secret when EVM watcher finds it
  useEffect(() => {
    if (evmWatcher.secret && !isSuiChain) {
      setSecret(evmWatcher.secret);
    }
  }, [evmWatcher.secret, isSuiChain]);

  // Clear secret when swap ID changes
  useEffect(() => {
    setSecret(null);
  }, [swapId]);

  const isLoading = isSuiChain ? isSuiWatching : evmWatcher.isLoading;
  const error = isSuiChain ? suiError : evmWatcher.error;
  const refetch = isSuiChain ? () => {} : evmWatcher.refetch;

  return {
    secret,
    isLoading,
    error,
    refetch,
    chainType: isSuiChain ? 'sui' : 'evm',
  };
}
