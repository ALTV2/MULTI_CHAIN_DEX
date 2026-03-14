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
const CLOCK_OBJECT_ID = '0x6'; // SUI Clock object

export interface CreateSuiOrderParams {
  sellToken: string; // Token type (e.g., "0x2::sui::SUI")
  sellAmount: bigint; // Amount in base units (e.g., 500000000 for 0.5 SUI with 9 decimals)
  buyToken: string;
  buyAmount: bigint; // Amount in base units
  targetChainId: number;
  targetAddress: string; // Where to receive tokens on target chain
  minTimelock: bigint; // Minimum HTLC timelock in seconds (default: 3600)
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
  status: 'Active' | 'Matched' | 'Completed' | 'Cancelled';
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
      if (!account) {
        throw new Error('SUI wallet not connected');
      }

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();

        // Convert token addresses to bytes
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

        const result = await signAndExecute({
          transaction: tx,
        });

        toast.success('Order created successfully on SUI!');
        return result.digest;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to create order';
        setError(errorMsg);
        toast.error(errorMsg);
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
      if (!account) {
        throw new Error('SUI wallet not connected');
      }

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: `${PACKAGE_ID}::cross_chain_order_book::match_order`,
          arguments: [
            tx.object(ORDER_BOOK_ID),
            tx.pure.u64(orderId),
            tx.pure.vector('u8', Array.from(Buffer.from(swapId.slice(2), 'hex'))),
            tx.object(CLOCK_OBJECT_ID),
          ],
        });

        const result = await signAndExecute({
          transaction: tx,
        });

        toast.success('Order matched successfully on SUI!');
        return result.digest;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to match order';
        setError(errorMsg);
        toast.error(errorMsg);
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
      if (!account) {
        throw new Error('SUI wallet not connected');
      }

      setIsPending(true);
      setError(null);

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: `${PACKAGE_ID}::cross_chain_order_book::cancel_order`,
          arguments: [tx.object(ORDER_BOOK_ID), tx.pure.u64(orderId)],
        });

        const result = await signAndExecute({
          transaction: tx,
        });

        toast.success('Order cancelled successfully on SUI!');
        return result.digest;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to cancel order';
        setError(errorMsg);
        toast.error(errorMsg);
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
 * Hook to query active orders from SUI OrderBook
 * Note: This is a simplified version. In production, you'd use SUI's
 * dynamic field queries to fetch orders from the Table structure.
 */
export function useSuiOrders(targetChainId?: number) {
  const client = useSuiClient();
  const [orders, setOrders] = useState<SuiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Manual refetch function
  const refetch = () => {
    console.log('🔄 [useSuiOrders] Manual refetch triggered');
    setRefetchTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      console.log('🔍 [useSuiOrders] fetchOrders called, targetChainId:', targetChainId);
      setIsLoading(true);
      setError(null);

      try {
        // Fetch the OrderBook object
        console.log('🔍 [useSuiOrders] Fetching OrderBook object...');
        const orderBookObject = await client.getObject({
          id: ORDER_BOOK_ID,
          options: {
            showContent: true,
            showType: true,
          },
        });
        console.log('🔍 [useSuiOrders] OrderBook object:', orderBookObject);

        if (!orderBookObject.data) {
          throw new Error('OrderBook not found');
        }

        // Debug: Check OrderBook state
        if (!orderBookObject.data.content || !('fields' in orderBookObject.data.content)) {
          throw new Error('OrderBook content not found');
        }

        const fields = orderBookObject.data.content.fields as any;
        console.log('📊 [DEBUG] OrderBook state:', {
          next_order_id: fields.next_order_id,
          chain_id: fields.chain_id,
          supported_chains: fields.supported_chains,
          orders_table_id: fields.orders?.fields?.id?.id || 'N/A',
        });

        // Critical check: if next_order_id is still 1, no orders were created
        if (fields.next_order_id === '1') {
          console.warn('⚠️ next_order_id is still 1 - no orders have been created successfully!');
        }

        // CRITICAL FIX: Get the Table object ID from the orders field
        // The Table stores its entries as dynamic fields on the Table object itself,
        // not on the parent OrderBook object!
        const tableObjectId = fields.orders?.fields?.id?.id;
        if (!tableObjectId) {
          throw new Error('Orders Table ID not found in OrderBook');
        }
        console.log('📋 [useSuiOrders] Orders Table ID:', tableObjectId);

        // Query dynamic fields of the TABLE object (not OrderBook!)
        console.log('🔍 [useSuiOrders] Fetching dynamic fields from Table...');
        const dynamicFields = await client.getDynamicFields({
          parentId: tableObjectId, // Use Table ID, not OrderBook ID!
        });
        console.log('🔍 [useSuiOrders] Dynamic fields:', dynamicFields);

        if (!dynamicFields.data || dynamicFields.data.length === 0) {
          console.log('🔍 [useSuiOrders] No dynamic fields found');
          if (isMounted) {
            setOrders([]);
          }
          return;
        }

        // Fetch each order from dynamic fields
        const orderPromises = dynamicFields.data.map(async (field) => {
          try {
            console.log('🔍 [DEBUG] Fetching field:', field);

            const fieldObject = await client.getDynamicFieldObject({
              parentId: tableObjectId, // Use Table ID, not OrderBook ID!
              name: {
                type: 'u64',
                value: field.name.value as string,
              },
            });

            console.log('🔍 [DEBUG] Full fieldObject structure:', JSON.stringify(fieldObject, null, 2));

            if (fieldObject.data && fieldObject.data.content && 'fields' in fieldObject.data.content) {
              const fields = fieldObject.data.content.fields as any;
              console.log('🔍 [DEBUG] fields:', fields);

              // CRITICAL FIX: The order data is in fields.value.fields, not fields.value!
              // fields.value = { type: "...", fields: { actual order data } }
              const orderValue = fields.value as any;
              const order = orderValue.fields as any;
              console.log('🔍 [DEBUG] order (fields.value.fields):', order);

              console.log('✅ [useSuiOrders] Found order:', {
                id: order.id,
                creator: order.creator,
                sell_token_bytes: order.sell_token,
                buy_token_bytes: order.buy_token,
                target_chain_id: order.target_chain_id,
                status: order.status,
              });

              // Parse order data
              const parsedOrder = {
                id: order.id,
                creator: order.creator,
                sellToken: new TextDecoder().decode(new Uint8Array(order.sell_token)),
                sellAmount: BigInt(order.sell_amount),
                buyToken: new TextDecoder().decode(new Uint8Array(order.buy_token)),
                buyAmount: BigInt(order.buy_amount),
                targetChainId: parseInt(order.target_chain_id),
                expiresAt: BigInt(order.expires_at),
                status: order.status === 0 ? 'Active' : order.status === 1 ? 'Matched' : order.status === 2 ? 'Completed' : 'Cancelled',
              } as SuiOrder;

              console.log('✅ [useSuiOrders] Parsed order:', parsedOrder);
              return parsedOrder;
            }
            return null;
          } catch (err) {
            console.error('❌ Error fetching order field:', err);
            return null;
          }
        });

        const allOrders = (await Promise.all(orderPromises)).filter(
          (order): order is SuiOrder => order !== null
        );

        // CRITICAL: Filter out cancelled/completed orders - only show Active orders
        const activeOrders = allOrders.filter((order) => order.status === 'Active');

        // Filter by target chain if specified
        const filteredOrders = targetChainId !== undefined
          ? activeOrders.filter((order) => order.targetChainId === targetChainId)
          : activeOrders;

        console.log('📦 SUI Orders fetched:', {
          total: allOrders.length,
          active: activeOrders.length,
          filtered: filteredOrders.length,
          targetChainIdFilter: targetChainId,
          orders: filteredOrders.map(o => ({
            id: o.id,
            status: o.status,
            sell: o.sellToken,
            buy: o.buyToken,
            targetChain: o.targetChainId,
            creator: o.creator,
          })),
        });

        if (isMounted) {
          setOrders(filteredOrders);
        }
      } catch (err: any) {
        if (isMounted) {
          const errorMsg = err.message || 'Failed to fetch SUI orders';
          setError(errorMsg);
          console.error('Error fetching SUI orders:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOrders();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchOrders, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [client, targetChainId, refetchTrigger]);

  return { orders, isLoading, error, refetch };
}

/**
 * Hook to get a specific order by ID from SUI
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

    const fetchOrder = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: Query the specific order from the Table structure
        // This requires querying dynamic fields with the order ID as key

        if (isMounted) {
          setOrder(null);
        }
      } catch (err: any) {
        if (isMounted) {
          const errorMsg = err.message || 'Failed to fetch SUI order';
          setError(errorMsg);
          console.error('Error fetching SUI order:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [client, orderId]);

  return { order, isLoading, error };
}
