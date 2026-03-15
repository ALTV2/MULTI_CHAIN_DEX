'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import type { SuiOrder } from './useSuiOrders';

const ORDER_BOOK_ID = '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0';

const STATUS_MAP: Record<number, SuiOrder['status']> = {
  0: 'Active',
  1: 'Matched',
  2: 'Completed',
  3: 'Cancelled',
  4: 'Expired',
};

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
 * Hook to fetch orders created by the current SUI wallet.
 * Polls every 10 seconds.
 */
export function useSuiUserOrders() {
  const suiAccount = useCurrentAccount();
  const client = useSuiClient();
  const [orders, setOrders] = useState<SuiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!suiAccount?.address) {
      setOrders([]);
      return;
    }

    const userAddress = suiAccount.address.toLowerCase();
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const obj = await client.getObject({
          id: ORDER_BOOK_ID,
          options: { showContent: true },
        });

        if (!obj.data?.content || !('fields' in obj.data.content)) {
          throw new Error('OrderBook not found');
        }

        const tableId = (obj.data.content.fields as any)?.orders?.fields?.id?.id;
        if (!tableId) throw new Error('Orders Table ID not found');

        const dynamicFields = await client.getDynamicFields({ parentId: tableId });
        if (!dynamicFields.data?.length) {
          if (isMounted) setOrders([]);
          return;
        }

        const results = await Promise.allSettled(
          dynamicFields.data.map((field) =>
            client.getDynamicFieldObject({
              parentId: tableId,
              name: { type: 'u64', value: field.name.value as string },
            })
          )
        );

        const userOrders: SuiOrder[] = [];
        for (const result of results) {
          if (result.status !== 'fulfilled') continue;
          const fieldObj = result.value;
          if (!fieldObj.data?.content || !('fields' in fieldObj.data.content)) continue;

          const parsed = parseSuiOrder(fieldObj.data.content.fields);
          if (parsed && parsed.creator.toLowerCase() === userAddress) {
            userOrders.push(parsed);
          }
        }

        if (isMounted) setOrders(userOrders);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to fetch SUI user orders');
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
  }, [client, suiAccount?.address]);

  return { orders, isLoading, error };
}
