'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderRow } from './OrderRow';
import { useOrderBook } from '@/hooks/useOrderBook';
import { cn } from '@/lib/utils/cn';
import type { Token } from '@/types/token';

export function OrderBook() {
  const { orders, isLoading, isError, refetch } = useOrderBook();
  const [filterToken, setFilterToken] = useState<Token | undefined>();

  const filteredOrders = filterToken
    ? orders.filter(
        (order) =>
          order.sellToken.address === filterToken.address ||
          order.buyToken.address === filterToken.address
      )
    : orders;

  // Get unique tokens from orders
  const uniqueTokens = Array.from(
    new Set(
      orders.flatMap((order) => [
        order.sellToken.address,
        order.buyToken.address,
      ])
    )
  )
    .map((address) => {
      const order = orders.find(
        (o) =>
          o.sellToken.address === address || o.buyToken.address === address
      );
      return order?.sellToken.address === address
        ? order.sellToken
        : order?.buyToken;
    })
    .filter((token): token is Token => token !== undefined);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Order Book</CardTitle>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
            title="Refresh"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Token Filter */}
        {uniqueTokens.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setFilterToken(undefined)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                !filterToken
                  ? 'bg-accent-blue text-white'
                  : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-light-border dark:hover:bg-dark-border'
              )}
            >
              All ({orders.length})
            </button>
            {uniqueTokens.map((token) => {
              const count = orders.filter(
                (order) =>
                  order.sellToken.address === token.address ||
                  order.buyToken.address === token.address
              ).length;

              return (
                <button
                  key={token.address}
                  onClick={() => setFilterToken(token)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filterToken?.address === token.address
                      ? 'bg-accent-blue text-white'
                      : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-light-border dark:hover:bg-dark-border'
                  )}
                >
                  {token.symbol} ({count})
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              Failed to load orders
            </div>
            <button
              onClick={() => refetch()}
              className="text-accent-blue hover:text-blue-600 text-sm font-medium"
            >
              Try again
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div className="text-gray-500 dark:text-gray-400">
              {filterToken
                ? `No orders found for ${filterToken.symbol}`
                : 'No active orders yet'}
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Be the first to create an order!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderRow key={order.id.toString()} order={order} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
