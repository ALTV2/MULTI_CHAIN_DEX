'use client';

import { useState, useEffect, useRef } from 'react';
import { useChainId } from 'wagmi';
import { waitForTx } from '@/lib/utils/rpcClient';

/**
 * Drop-in replacement for wagmi's useWaitForTransactionReceipt.
 * Uses our own Alchemy RPC which is more reliable than wallet's RPC.
 */
export function useTxReceipt(hash: `0x${string}` | undefined, chainIdOverride?: number) {
  const walletChainId = useChainId();
  const chainId = chainIdOverride ?? walletChainId;
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const processedHash = useRef<string | undefined>();

  useEffect(() => {
    if (!hash || hash === processedHash.current) return;
    processedHash.current = hash;
    setIsLoading(true);
    setIsSuccess(false);

    waitForTx(chainId, hash).then((success) => {
      setIsLoading(false);
      setIsSuccess(success);
    });
  }, [hash, chainId]);

  return { isLoading, isSuccess };
}
