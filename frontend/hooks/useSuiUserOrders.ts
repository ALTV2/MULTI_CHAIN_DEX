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

    const rawTargetAddress = String(fields.target_address ?? '');
    let targetAddress = rawTargetAddress;
    if (/^0x0{24}[0-9a-fA-F]{40}$/.test(rawTargetAddress)) {
      targetAddress = '0x' + rawTargetAddress.slice(-40);
    }

    // Parse matched_by (matcher's SUI address)
    const matchedBy = String(fields.matched_by ?? '');

    // Parse htlc_swap_id (32-byte vector<u8> → 0x-prefixed hex string)
    const rawHtlcSwapId: number[] = Array.from(fields.htlc_swap_id ?? []);
    const matcherHtlcSwapId = rawHtlcSwapId.length === 32
      ? '0x' + rawHtlcSwapId.map((b) => (b as number).toString(16).padStart(2, '0')).join('')
      : undefined;

    return {
      id: String(fields.id ?? ''),
      creator: String(fields.creator ?? ''),
      sellToken: new TextDecoder().decode(new Uint8Array(fields.sell_token ?? [])),
      sellAmount: BigInt(fields.sell_amount ?? 0),
      buyToken: new TextDecoder().decode(new Uint8Array(fields.buy_token ?? [])),
      buyAmount: BigInt(fields.buy_amount ?? 0),
      targetChainId: parseInt(String(fields.target_chain_id ?? '0'), 10),
      targetAddress,
      expiresAt: BigInt(fields.expires_at ?? 0),
      status: STATUS_MAP[statusNum] ?? 'Cancelled',
      matchedBy: matchedBy && matchedBy !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? matchedBy : undefined,
      matcherHtlcSwapId,
    };
  } catch {
    return null;
  }
}

/**
 * Hook to fetch SUI CCOB orders relevant to the current SUI wallet:
 * - creatorOrders: orders created by this wallet
 * - matcherOrders: Matched orders where matched_by = this wallet
 * Polls every 10 seconds.
 */
export function useSuiUserOrders() {
  const suiAccount = useCurrentAccount();
  const client = useSuiClient();
  const [creatorOrders, setCreatorOrders] = useState<SuiOrder[]>([]);
  const [matcherOrders, setMatcherOrders] = useState<SuiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!suiAccount?.address) {
      setCreatorOrders([]);
      setMatcherOrders([]);
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
          if (isMounted) { setCreatorOrders([]); setMatcherOrders([]); }
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

        const myCreatorOrders: SuiOrder[] = [];
        const myMatcherOrders: SuiOrder[] = [];

        for (const result of results) {
          if (result.status !== 'fulfilled') continue;
          const fieldObj = result.value;
          if (!fieldObj.data?.content || !('fields' in fieldObj.data.content)) continue;

          const parsed = parseSuiOrder(fieldObj.data.content.fields);
          if (!parsed) continue;

          if (parsed.creator.toLowerCase() === userAddress) {
            myCreatorOrders.push(parsed);
          } else if (parsed.matchedBy?.toLowerCase() === userAddress) {
            myMatcherOrders.push(parsed);
          }
        }

        if (isMounted) {
          setCreatorOrders(myCreatorOrders);
          setMatcherOrders(myMatcherOrders);
        }
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to fetch SUI user orders');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [client, suiAccount?.address]);

  // Keep backward compat: `orders` = creator orders only
  return { orders: creatorOrders, creatorOrders, matcherOrders, isLoading, error };
}
