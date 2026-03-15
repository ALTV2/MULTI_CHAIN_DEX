'use client';

/**
 * SUI HTLC Hooks
 *
 * Provides React hooks for interacting with SUI HTLC contracts
 * Uses @mysten/dapp-kit for wallet integration and transactions
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { getContractAddress } from '@/lib/contracts/addresses';
import { hexToBytes } from '@/lib/utils/crossChainCrypto';

const PACKAGE_ID = getContractAddress('sui:testnet', 'htlc');
const CLOCK_OBJECT_ID = '0x6'; // SUI Clock object

export interface SuiSwapData {
  swapId: Uint8Array;
  initiator: string;
  participant: string;
  amount: string;
  hashlock: Uint8Array;
  timelock: string;
  status: number; // 1=Active, 2=Withdrawn, 3=Refunded
}

/**
 * Hook for creating HTLC swaps on SUI
 */
export function useCreateSuiHTLC() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createSwap = useCallback(
    async (params: {
      swapId: `0x${string}`;
      participant: string;
      hashlock: `0x${string}`;
      timelock: bigint | number;
      tokenType: string; // Full SUI type (e.g., '0x2::sui::SUI')
      amount: bigint | number;
    }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();

        // Convert hex values to Uint8Array for Move
        const swapIdBytes = Array.from(hexToBytes(params.swapId));
        const hashlockBytes = Array.from(hexToBytes(params.hashlock));

        // Split coins for payment (convert to string for u64)
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(params.amount.toString())]);

        // Call create_swap function
        tx.moveCall({
          target: `${PACKAGE_ID}::htlc::create_swap`,
          arguments: [
            tx.pure.vector('u8', swapIdBytes),
            tx.pure.address(params.participant),
            tx.pure.vector('u8', hashlockBytes),
            tx.pure.u64(params.timelock),
            coin,
            tx.object(CLOCK_OBJECT_ID),
          ],
          typeArguments: [params.tokenType],
        });

        const result = await signAndExecute({
          transaction: tx,
        });

        setIsPending(false);
        return result.digest;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transaction failed');
        setError(error);
        setIsPending(false);
        throw error;
      }
    },
    [account, signAndExecute]
  );

  return {
    createSwap,
    isPending,
    error,
    isConnected: !!account,
  };
}

/**
 * Hook for withdrawing from HTLC swaps on SUI
 */
export function useWithdrawSuiHTLC() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withdraw = useCallback(
    async (params: {
      swapObjectId: string;
      secret: `0x${string}`;
      tokenType: string;
    }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();

        // Convert secret to Uint8Array
        const secretBytes = Array.from(hexToBytes(params.secret));

        // Call withdraw function
        tx.moveCall({
          target: `${PACKAGE_ID}::htlc::withdraw`,
          arguments: [
            tx.object(params.swapObjectId),
            tx.pure.vector('u8', secretBytes),
            tx.object(CLOCK_OBJECT_ID),
          ],
          typeArguments: [params.tokenType],
        });

        const result = await signAndExecute({
          transaction: tx,
        });

        setIsPending(false);
        return result.digest;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transaction failed');
        setError(error);
        setIsPending(false);
        throw error;
      }
    },
    [account, signAndExecute]
  );

  return {
    withdraw,
    isPending,
    error,
    isConnected: !!account,
  };
}

/**
 * Hook for refunding HTLC swaps on SUI
 */
export function useRefundSuiHTLC() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refund = useCallback(
    async (params: { swapObjectId: string; tokenType: string }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();

        // Call refund function
        tx.moveCall({
          target: `${PACKAGE_ID}::htlc::refund`,
          arguments: [tx.object(params.swapObjectId), tx.object(CLOCK_OBJECT_ID)],
          typeArguments: [params.tokenType],
        });

        const result = await signAndExecute({
          transaction: tx,
        });

        setIsPending(false);
        return result.digest;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transaction failed');
        setError(error);
        setIsPending(false);
        throw error;
      }
    },
    [account, signAndExecute]
  );

  return {
    refund,
    isPending,
    error,
    isConnected: !!account,
  };
}

/**
 * Hook for querying SUI swap data
 */
export function useSuiSwap(swapObjectId: string | undefined) {
  const client = useSuiClient();
  const [data, setData] = useState<SuiSwapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSwap = useCallback(async () => {
    if (!swapObjectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const object = await client.getObject({
        id: swapObjectId,
        options: { showContent: true },
      });

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any;

        setData({
          swapId: fields.swap_id,
          initiator: fields.initiator,
          participant: fields.participant,
          amount: fields.balance?.toString() || '0',
          hashlock: fields.hashlock,
          timelock: fields.timelock?.toString() || '0',
          status: parseInt(fields.status || '0'),
        });
      }

      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch swap');
      setError(error);
      setIsLoading(false);
    }
  }, [client, swapObjectId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchSwap,
  };
}

// How many pages of events to look back when searching for a revealed secret.
// Each page has up to 50 events. 20 pages × 50 = 1000 events lookback.
const SUI_SECRET_SEARCH_PAGES = 20;
const SUI_SECRET_POLL_INTERVAL_MS = 5_000;

interface SwapWithdrawnEvent {
  swap_id: number[];
  swap_object_id: string;
  secret: number[];
  participant: string;
}

/**
 * Search paginated SwapWithdrawn events for a secret matching the given swapId.
 * Uses cursor-based pagination so old events are not missed.
 */
async function findSecretInSuiEvents(
  client: ReturnType<typeof useSuiClient>,
  packageId: string,
  swapId: `0x${string}`
): Promise<`0x${string}` | null> {
  const targetBytes = Array.from(hexToBytes(swapId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = undefined;

  for (let page = 0; page < SUI_SECRET_SEARCH_PAGES; page++) {
    const result = await client.queryEvents({
      query: { MoveEventType: `${packageId}::htlc::SwapWithdrawn` },
      order: 'descending',
      limit: 50,
      cursor,
    });

    for (const event of result.data) {
      if (!event.parsedJson || typeof event.parsedJson !== 'object') continue;
      const parsed = event.parsedJson as Partial<SwapWithdrawnEvent>;
      const eventBytes = parsed.swap_id;
      if (
        eventBytes &&
        eventBytes.length === targetBytes.length &&
        eventBytes.every((b, i) => b === targetBytes[i])
      ) {
        const secretBytes = parsed.secret;
        if (secretBytes) {
          return `0x${secretBytes.map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
        }
      }
    }

    // Stop if no more pages
    if (!result.hasNextPage || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return null;
}

/**
 * Hook for watching SUI events for secret reveals.
 * Polls paginated SwapWithdrawn events until the secret is found.
 * Used by the matcher (EVM side) after Alice withdraws on SUI.
 */
export function useSuiSecretWatcher(
  swapId: `0x${string}` | undefined,
  onSecretRevealed: (secret: `0x${string}`) => void
) {
  const client = useSuiClient();
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSearching = useRef(false);

  useEffect(() => {
    if (!swapId) return;

    setIsWatching(true);
    setError(null);
    let isMounted = true;

    const pollForSecret = async () => {
      if (isSearching.current) return;
      isSearching.current = true;

      try {
        const secret = await findSecretInSuiEvents(client, PACKAGE_ID, swapId);

        if (!isMounted) return;

        if (secret) {
          setIsWatching(false);
          onSecretRevealed(secret);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to poll SUI events');
        }
      } finally {
        isSearching.current = false;
      }
    };

    pollForSecret();
    const interval = setInterval(pollForSecret, SUI_SECRET_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
      setIsWatching(false);
      isSearching.current = false;
    };
  }, [client, swapId, onSecretRevealed]);

  return { isWatching, error };
}
