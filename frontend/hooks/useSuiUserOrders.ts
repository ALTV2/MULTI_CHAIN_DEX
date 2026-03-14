'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import type { SuiOrder } from './useSuiOrders';

const ORDER_BOOK_ID = '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0';

/**
 * Hook to fetch orders created by the current SUI wallet
 * Filters all SUI orders by creator address
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
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchUserOrders = async () => {
      console.log('🔍 [useSuiUserOrders] Fetching orders for:', suiAccount.address);
      setIsLoading(true);
      setError(null);

      try {
        // Fetch the OrderBook object
        const orderBookObject = await client.getObject({
          id: ORDER_BOOK_ID,
          options: {
            showContent: true,
            showType: true,
          },
        });

        if (!orderBookObject.data) {
          throw new Error('OrderBook not found');
        }

        // Get the Table object ID from the orders field
        if (!orderBookObject.data.content || !('fields' in orderBookObject.data.content)) {
          throw new Error('OrderBook content not found');
        }

        const fields = orderBookObject.data.content.fields as any;
        const tableObjectId = fields.orders?.fields?.id?.id;

        if (!tableObjectId) {
          throw new Error('Orders Table ID not found in OrderBook');
        }

        console.log('📋 [useSuiUserOrders] Orders Table ID:', tableObjectId);

        // Query dynamic fields of the TABLE object
        const dynamicFields = await client.getDynamicFields({
          parentId: tableObjectId,
        });

        console.log('🔍 [useSuiUserOrders] Dynamic fields:', dynamicFields);

        if (!dynamicFields.data || dynamicFields.data.length === 0) {
          console.log('🔍 [useSuiUserOrders] No dynamic fields found');
          if (isMounted) {
            setOrders([]);
          }
          return;
        }

        // Fetch each order from dynamic fields
        const orderPromises = dynamicFields.data.map(async (field) => {
          try {
            const fieldObject = await client.getDynamicFieldObject({
              parentId: tableObjectId,
              name: {
                type: 'u64',
                value: field.name.value as string,
              },
            });

            if (fieldObject.data && fieldObject.data.content && 'fields' in fieldObject.data.content) {
              const fields = fieldObject.data.content.fields as any;
              const orderValue = fields.value as any;
              const order = orderValue.fields as any;

              // Parse order data
              const parsedOrder: SuiOrder = {
                id: order.id,
                creator: order.creator,
                sellToken: new TextDecoder().decode(new Uint8Array(order.sell_token)),
                sellAmount: BigInt(order.sell_amount),
                buyToken: new TextDecoder().decode(new Uint8Array(order.buy_token)),
                buyAmount: BigInt(order.buy_amount),
                targetChainId: parseInt(order.target_chain_id),
                expiresAt: BigInt(order.expires_at),
                status: order.status === 0 ? 'Active' : order.status === 1 ? 'Matched' : order.status === 2 ? 'Completed' : 'Cancelled',
              };

              // Filter: only return orders created by current user
              if (parsedOrder.creator.toLowerCase() === suiAccount.address.toLowerCase()) {
                console.log('✅ [useSuiUserOrders] Found user order:', parsedOrder.id);
                return parsedOrder;
              }

              return null;
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

        console.log('📦 SUI User Orders fetched:', {
          total: dynamicFields.data.length,
          userOrders: allOrders.length,
          userAddress: suiAccount.address,
        });

        if (isMounted) {
          setOrders(allOrders);
        }
      } catch (err: any) {
        if (isMounted) {
          const errorMsg = err.message || 'Failed to fetch SUI user orders';
          setError(errorMsg);
          console.error('Error fetching SUI user orders:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserOrders();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchUserOrders, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [client, suiAccount?.address]);

  return { orders, isLoading, error };
}
