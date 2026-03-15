'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'sonner';
import {
  SUI_PKG,
  SUI_TKA_TYPE,
  SUI_TKB_TYPE,
  SUI_NATIVE_TYPE,
  type SuiPairConfig,
  getKnownPairs,
  registerPair,
  findPairConfig,
} from '@/lib/sui/pairRegistry';

// Re-export types and constants for backward compatibility
export { SUI_TKA_TYPE, SUI_TKB_TYPE, SUI_NATIVE_TYPE };
export type { SuiPairConfig };
export { findPairConfig };

// Legacy export — prefer getKnownPairs() for dynamic list
export const SUI_PAIR_CONFIGS: SuiPairConfig[] = getKnownPairs();

export interface SuiSameChainOrder {
  orderId: number;        // numeric order ID from contract
  orderObjectId: string;  // SUI object ID of the Order<CoinA,CoinB> shared object
  creator: string;
  sellAmount: bigint;
  buyAmount: bigint;
  status: 'Active' | 'Filled' | 'Cancelled';
  pairConfig: SuiPairConfig;
}

const STATUS_MAP: Record<number, SuiSameChainOrder['status']> = {
  0: 'Active',
  1: 'Filled',
  2: 'Cancelled',
};

// ─────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────

async function getTableId(
  client: ReturnType<typeof useSuiClient>,
  pairObjectId: string
): Promise<string> {
  const obj = await client.getObject({ id: pairObjectId, options: { showContent: true } });
  if (!obj.data?.content || !('fields' in obj.data.content)) {
    throw new Error(`OrderBookPair ${pairObjectId} not found`);
  }
  const tableId = (obj.data.content.fields as any)?.orders?.fields?.id?.id;
  if (!tableId) throw new Error('Orders table ID not found');
  return tableId as string;
}

async function fetchPairOrders(
  client: ReturnType<typeof useSuiClient>,
  pairConfig: SuiPairConfig
): Promise<SuiSameChainOrder[]> {
  const tableId = await getTableId(client, pairConfig.pairId);

  const dynamicFields = await client.getDynamicFields({ parentId: tableId });
  if (!dynamicFields.data?.length) return [];

  // Use objectIds from getDynamicFields directly — avoids getDynamicFieldObject u64 issues
  const fieldObjects = await Promise.allSettled(
    dynamicFields.data.map((f) =>
      client.getObject({ id: f.objectId, options: { showContent: true } })
    )
  );

  const orders: SuiSameChainOrder[] = [];
  for (const result of fieldObjects) {
    if (result.status !== 'fulfilled') continue;
    const fieldObj = result.value;
    if (!fieldObj.data?.content || !('fields' in fieldObj.data.content)) continue;

    const orderAddress = (fieldObj.data.content.fields as any)?.value;
    if (!orderAddress || typeof orderAddress !== 'string') continue;

    try {
      const orderObj = await client.getObject({ id: orderAddress, options: { showContent: true } });
      if (!orderObj.data?.content || !('fields' in orderObj.data.content)) continue;

      const f = orderObj.data.content.fields as any;
      const statusNum = typeof f.status === 'number' ? f.status : parseInt(String(f.status ?? '0'), 10);

      orders.push({
        orderId: parseInt(String(f.order_id ?? '0'), 10),
        orderObjectId: orderAddress,
        creator: String(f.creator ?? ''),
        sellAmount: BigInt(f.sell_amount ?? 0),
        buyAmount: BigInt(f.buy_amount ?? 0),
        status: STATUS_MAP[statusNum] ?? 'Cancelled',
        pairConfig,
      });
    } catch (err) {
      console.warn('[useSuiSameChainOrders] failed to fetch order at', orderAddress, err);
    }
  }

  return orders;
}

// ─────────────────────────────────────────────
// Hook: list all same-chain orders across all known pairs
// ─────────────────────────────────────────────

export function useSuiSameChainOrders() {
  const client = useSuiClient();
  const [orders, setOrders] = useState<SuiSameChainOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => setRefetchTrigger((n) => n + 1), []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        // Re-read known pairs every poll cycle to pick up newly registered pairs
        const pairs = getKnownPairs();
        const allResults = await Promise.allSettled(
          pairs.map((cfg) => fetchPairOrders(client, cfg))
        );

        const combined: SuiSameChainOrder[] = [];
        for (const r of allResults) {
          if (r.status === 'fulfilled') combined.push(...r.value);
          else console.error('[useSuiSameChainOrders] pair fetch failed:', r.reason);
        }

        console.log('[useSuiSameChainOrders] fetched orders:', combined.length, combined);
        if (isMounted) setOrders(combined);
      } catch (err) {
        console.error('[useSuiSameChainOrders] fetch error:', err);
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
  }, [client, refetchTrigger]);

  return { orders, isLoading, refetch };
}

// ─────────────────────────────────────────────
// Hook: create a same-chain order (with on-demand pair init)
// ─────────────────────────────────────────────

export interface CreateSuiSameChainOrderParams {
  coinAType: string;   // token to sell
  coinBType: string;   // token to buy
  sellAmount: bigint;  // in base units (9 decimals)
  buyAmount: bigint;
}

export function useCreateSuiSameChainOrder() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(
    async (params: CreateSuiSameChainOrderParams) => {
      if (!account) throw new Error('SUI wallet not connected');

      setIsPending(true);
      setError(null);

      try {
        // ── Step 1: find or create the trading pair ──────────────────
        let pairConfig = findPairConfig(params.coinAType, params.coinBType);

        if (!pairConfig) {
          toast.info(`Creating trading pair ${params.coinAType.split('::').pop()} ↔ ${params.coinBType.split('::').pop()}…`);

          // init_pair<CoinA, CoinB>() — creates a shared OrderBookPair object
          const initTx = new Transaction();
          initTx.moveCall({
            target: `${SUI_PKG}::order_book::init_pair`,
            typeArguments: [params.coinAType, params.coinBType],
            arguments: [],
          });

          const initResult = await signAndExecute({ transaction: initTx });

          // Fetch full tx details to get objectChanges (dapp-kit v1 returns only digest)
          const txDetails = await client.waitForTransaction({
            digest: initResult.digest,
            options: { showObjectChanges: true },
          });

          const newPairObj = txDetails.objectChanges?.find(
            (c: any) => c.type === 'created' && c.objectType?.includes('OrderBookPair')
          );

          if (!newPairObj || !('objectId' in newPairObj)) {
            throw new Error('Failed to create trading pair: could not find new pair object ID');
          }

          pairConfig = {
            pairId: (newPairObj as any).objectId,
            coinAType: params.coinAType,
            coinBType: params.coinBType,
          };

          // Persist for future sessions
          registerPair(pairConfig);
          toast.success('Trading pair created!');
        }

        // ── Step 2: create the order ─────────────────────────────────
        const tx = new Transaction();
        let splitCoin;

        const isNativeSui = params.coinAType === SUI_NATIVE_TYPE;

        if (isNativeSui) {
          // For native SUI: split from tx.gas (the gas coin) — avoids "no gas coins" error
          [splitCoin] = tx.splitCoins(tx.gas, [params.sellAmount]);
        } else {
          // For custom tokens: fetch and merge all coin objects, then split exact amount
          const coins = await client.getCoins({
            owner: account.address,
            coinType: params.coinAType,
          });

          if (!coins.data.length) {
            throw new Error(`No ${params.coinAType.split('::').pop()} coins found in wallet`);
          }

          const primaryCoin = tx.object(coins.data[0].coinObjectId);
          if (coins.data.length > 1) {
            tx.mergeCoins(
              primaryCoin,
              coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
            );
          }
          [splitCoin] = tx.splitCoins(primaryCoin, [params.sellAmount]);
        }

        tx.moveCall({
          target: `${SUI_PKG}::order_book::create_order`,
          typeArguments: [params.coinAType, params.coinBType],
          arguments: [
            tx.object(pairConfig.pairId),
            splitCoin,
            tx.pure.u64(params.buyAmount),
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
    [account, client, signAndExecute]
  );

  return { createOrder, isPending, error };
}

// ─────────────────────────────────────────────
// Hook: fill (match) a same-chain order
// ─────────────────────────────────────────────

export function useFillSuiSameChainOrder() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillOrder = useCallback(
    async (order: SuiSameChainOrder) => {
      if (!account) throw new Error('SUI wallet not connected');

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();
        let splitCoin;

        const isNativeSuiPayment = order.pairConfig.coinBType === SUI_NATIVE_TYPE;

        if (isNativeSuiPayment) {
          [splitCoin] = tx.splitCoins(tx.gas, [order.buyAmount]);
        } else {
          const coins = await client.getCoins({
            owner: account.address,
            coinType: order.pairConfig.coinBType,
          });

          if (!coins.data.length) {
            throw new Error(`No ${order.pairConfig.coinBType.split('::').pop()} coins found in wallet`);
          }

          const primaryCoin = tx.object(coins.data[0].coinObjectId);
          if (coins.data.length > 1) {
            tx.mergeCoins(
              primaryCoin,
              coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
            );
          }
          [splitCoin] = tx.splitCoins(primaryCoin, [order.buyAmount]);
        }

        tx.moveCall({
          target: `${SUI_PKG}::order_book::fill_order`,
          typeArguments: [order.pairConfig.coinAType, order.pairConfig.coinBType],
          arguments: [tx.object(order.orderObjectId), splitCoin],
        });

        const result = await signAndExecute({ transaction: tx });
        toast.success('Order filled successfully!');
        return result.digest;
      } catch (err: any) {
        const msg = err?.message || 'Failed to fill order';
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [account, client, signAndExecute]
  );

  return { fillOrder, isPending, error };
}

// ─────────────────────────────────────────────
// Hook: cancel a same-chain order
// ─────────────────────────────────────────────

export function useCancelSuiSameChainOrder() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelOrder = useCallback(
    async (order: SuiSameChainOrder) => {
      if (!account) throw new Error('SUI wallet not connected');

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${SUI_PKG}::order_book::cancel_order`,
          typeArguments: [order.pairConfig.coinAType, order.pairConfig.coinBType],
          arguments: [tx.object(order.orderObjectId)],
        });

        const result = await signAndExecute({ transaction: tx });
        toast.success('Order cancelled!');
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
