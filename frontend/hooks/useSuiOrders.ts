'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'sonner';

const PACKAGE_ID = '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96';
const ORDER_BOOK_ID = '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0';
const CLOCK_OBJECT_ID = '0x6';

export interface CreateSuiOrderParams {
  sellToken: string;
  sellAmount: bigint;
  buyToken: string;
  buyAmount: bigint;
  targetChainId: number;
  targetAddress: string;
  minTimelock: bigint;
  expiresAt: bigint;
}

export interface SuiOrder {
  id: string;
  creator: string;
  sellToken: string;
  sellAmount: bigint;
  buyToken: string;
  buyAmount: bigint;
  targetChainId: number;
  expiresAt: bigint;
  status: 'Active' | 'Matched' | 'Completed' | 'Cancelled' | 'Expired';
}

const STATUS_MAP: Record<number, SuiOrder['status']> = {
  0: 'Active',
  1: 'Matched',
  2: 'Completed',
  3: 'Cancelled',
  4: 'Expired',
};

/**
 * Parse raw dynamic field content into a SuiOrder.
 * Returns null if data is malformed — does not throw.
 */
function parseSuiOrder(rawFields: unknown): SuiOrder | null {
  try {
    const fields = (rawFields as any)?.value?.fields;
    if (!fields) return null;

    const statusNum = parseInt(String(fields.status ?? '0'), 10);

    return {
      id: String(fields.id ?? ''),
      creator: String(fields.creator ?? ''),
      sellToken: new TextDecoder().decode(new Uint8Array(fields.sell_token ?? [])),
      sellAmount: BigInt(fields.sell_amount ?? 0),
      buyToken: new TextDecoder().decode(new Uint8Array(fields.buy_token ?? [])),
      buyAmount: BigInt(fields.buy_amount ?? 0),
      targetChainId: parseInt(String(fields.target_chain_id ?? '0'), 10),
      expiresAt: BigInt(fields.expires_at ?? 0),
      status: STATUS_MAP[statusNum] ?? 'Cancelled',
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the Table object ID from the OrderBook shared object.
 */
async function getOrdersTableId(
  client: ReturnType<typeof useSuiClient>
): Promise<string> {
  const obj = await client.getObject({
    id: ORDER_BOOK_ID,
    options: { showContent: true },
  });

  if (!obj.data?.content || !('fields' in obj.data.content)) {
    throw new Error('OrderBook not found or has no content');
  }

  const tableId = (obj.data.content.fields as any)?.orders?.fields?.id?.id;
  if (!tableId) throw new Error('Orders Table ID not found in OrderBook');

  return tableId as string;
}

/**
 * Fetch all orders from the Table via dynamic fields.
 */
async function fetchAllOrders(
  client: ReturnType<typeof useSuiClient>
): Promise<SuiOrder[]> {
  const tableId = await getOrdersTableId(client);

  const dynamicFields = await client.getDynamicFields({ parentId: tableId });
  if (!dynamicFields.data?.length) return [];

  const results = await Promise.allSettled(
    dynamicFields.data.map((field) =>
      client.getDynamicFieldObject({
        parentId: tableId,
        name: { type: 'u64', value: field.name.value as string },
      })
    )
  );

  const orders: SuiOrder[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const fieldObj = result.value;
    if (!fieldObj.data?.content || !('fields' in fieldObj.data.content)) continue;

    const parsed = parseSuiOrder(fieldObj.data.content.fields);
    if (parsed) orders.push(parsed);
  }

  return orders;
}

/**
 * Hook to create a cross-chain order on SUI
 */
export function useCreateSuiOrder() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(
    async (params: CreateSuiOrderParams) => {
      if (!account) throw new Error('SUI wallet not connected');

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();
        const sellTokenBytes = Array.from(new TextEncoder().encode(params.sellToken));
        const buyTokenBytes = Array.from(new TextEncoder().encode(params.buyToken));

        tx.moveCall({
          target: `${PACKAGE_ID}::cross_chain_order_book::create_order`,
          arguments: [
            tx.object(ORDER_BOOK_ID),
            tx.pure.vector('u8', sellTokenBytes),
            tx.pure.u64(params.sellAmount.toString()),
            tx.pure.vector('u8', buyTokenBytes),
            tx.pure.u64(params.buyAmount.toString()),
            tx.pure.u64(params.targetChainId),
            tx.pure.address(params.targetAddress),
            tx.pure.u64(params.minTimelock.toString()),
            tx.pure.u64(params.expiresAt.toString()),
            tx.object(CLOCK_OBJECT_ID),
          ],
        });

        const result = await signAndExecute({ transaction: tx });
        toast.success('Order created on SUI!');
        return result.digest;
      } catch (err: any) {
        const msg = err?.message || 'Failed to create order';
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [account, signAndExecute]
  );

  return { createOrder, isPending, error };
}

/**
 * Hook to match an existing cross-chain order on SUI
 */
export function useMatchSuiOrder() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchOrder = useCallback(
    async (orderId: string, swapId: string) => {
      if (!account) throw new Error('SUI wallet not connected');

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();
        const swapIdBytes = Array.from(Buffer.from(swapId.replace('0x', ''), 'hex'));

        tx.moveCall({
          target: `${PACKAGE_ID}::cross_chain_order_book::match_order`,
          arguments: [
            tx.object(ORDER_BOOK_ID),
            tx.pure.u64(orderId),
            tx.pure.vector('u8', swapIdBytes),
            tx.object(CLOCK_OBJECT_ID),
          ],
        });

        const result = await signAndExecute({ transaction: tx });
        toast.success('Order matched on SUI!');
        return result.digest;
      } catch (err: any) {
        const msg = err?.message || 'Failed to match order';
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [account, signAndExecute]
  );

  return { matchOrder, isPending, error };
}

/**
 * Hook to cancel a cross-chain order on SUI
 */
export function useCancelSuiOrder() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelOrder = useCallback(
    async (orderId: string) => {
      if (!account) throw new Error('SUI wallet not connected');

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::cross_chain_order_book::cancel_order`,
          arguments: [tx.object(ORDER_BOOK_ID), tx.pure.u64(orderId)],
        });

        const result = await signAndExecute({ transaction: tx });
        toast.success('Order cancelled on SUI!');
        return result.digest;
      } catch (err: any) {
        const msg = err?.message || 'Failed to cancel order';
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [account, signAndExecute]
  );

  return { cancelOrder, isPending, error };
}

/**
 * Hook to query active SUI orders, optionally filtered by target EVM chain.
 * Polls every 10 seconds.
 */
export function useSuiOrders(targetChainId?: number) {
  const client = useSuiClient();
  const [orders, setOrders] = useState<SuiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => setRefetchTrigger((n) => n + 1), []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const all = await fetchAllOrders(client);
        const active = all.filter((o) => o.status === 'Active');
        const filtered =
          targetChainId !== undefined
            ? active.filter((o) => o.targetChainId === targetChainId)
            : active;

        if (isMounted) setOrders(filtered);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to fetch SUI orders');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [client, targetChainId, refetchTrigger]);

  return { orders, isLoading, error, refetch };
}

/**
 * Hook to get a single SUI order by its numeric ID.
 */
export function useSuiOrder(orderId: string | undefined) {
  const client = useSuiClient();
  const [order, setOrder] = useState<SuiOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }

    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const tableId = await getOrdersTableId(client);
        const fieldObj = await client.getDynamicFieldObject({
          parentId: tableId,
          name: { type: 'u64', value: orderId },
        });

        if (!fieldObj.data?.content || !('fields' in fieldObj.data.content)) {
          throw new Error(`Order ${orderId} not found`);
        }

        const parsed = parseSuiOrder(fieldObj.data.content.fields);
        if (isMounted) setOrder(parsed);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to fetch SUI order');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [client, orderId]);

  return { order, isLoading, error };
}
