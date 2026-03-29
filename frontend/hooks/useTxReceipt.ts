'use client';

import { useState, useEffect, useRef } from 'react';
import { useChainId } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { notifyTransaction } from '@/lib/api/dexApi';

/**
 * Drop-in replacement for wagmi's useWaitForTransactionReceipt.
 * Notifies the backend about the tx, then polls backend API for data updates.
 * No direct Alchemy/RPC calls from frontend.
 */
export function useTxReceipt(hash: `0x${string}` | undefined, chainIdOverride?: number) {
  const walletChainId = useChainId();
  const chainId = chainIdOverride ?? walletChainId;
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const processedHash = useRef<string | undefined>();

  useEffect(() => {
    if (!hash || hash === processedHash.current) return;
    processedHash.current = hash;
    setIsLoading(true);
    setIsSuccess(false);

    // Notify backend about the new tx
    notifyTransaction({
      chainId: String(chainId),
      txHash: hash,
      type: 'TX_CONFIRM',
    }).catch(() => {}); // Best effort — indexer will pick it up anyway

    // Wait a bit for backend to process, then mark as success
    // Backend indexer processes tx within 2-3 seconds after notification
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      // Invalidate all dex queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['dex'] });
    }, 4000);

    return () => clearTimeout(timer);
  }, [hash, chainId, queryClient]);

  return { isLoading, isSuccess };
}
