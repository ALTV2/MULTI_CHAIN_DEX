'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderCard } from './OrderCard';
import { useUserOrders } from '@/hooks/useUserOrders';
import { OrderStatus } from '@/types/order';
import { cn } from '@/lib/utils/cn';

export function MyOrders() {
  const { isConnected } = useAccount();
  const { orders, isLoading, isError, refetch } = useUserOrders();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const filteredOrders =
    statusFilter === 'all'
      ? orders
      : orders.filter((order) => order.status === statusFilter);

  const statusCounts = {
    all: orders.length,
    active: orders.filter((o) => o.status === OrderStatus.Active).length,
    completed: orders.filter((o) => o.status === OrderStatus.Completed).length,
    cancelled: orders.filter((o) => o.status === OrderStatus.Cancelled).length,
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="text-center py-12">
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <div className="text-gray-500 dark:text-gray-400 mb-2">
            Connect your wallet
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Connect your wallet to view your orders
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Your Orders</CardTitle>
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

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-accent-blue text-white'
                : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-light-border dark:hover:bg-dark-border'
            )}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => setStatusFilter(OrderStatus.Active)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === OrderStatus.Active
                ? 'bg-accent-green text-white'
                : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-light-border dark:hover:bg-dark-border'
            )}
          >
            Active ({statusCounts.active})
          </button>
          <button
            onClick={() => setStatusFilter(OrderStatus.Completed)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === OrderStatus.Completed
                ? 'bg-accent-blue text-white'
                : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-light-border dark:hover:bg-dark-border'
            )}
          >
            Completed ({statusCounts.completed})
          </button>
          <button
            onClick={() => setStatusFilter(OrderStatus.Cancelled)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === OrderStatus.Cancelled
                ? 'bg-gray-500 text-white'
                : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-light-border dark:hover:bg-dark-border'
            )}
          >
            Cancelled ({statusCounts.cancelled})
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              Failed to load your orders
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
              {statusFilter === 'all'
                ? "You haven't created any orders yet"
                : `No ${
                    statusFilter === OrderStatus.Active
                      ? 'active'
                      : statusFilter === OrderStatus.Completed
                      ? 'completed'
                      : 'cancelled'
                  } orders`}
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Head to the trade page to create your first order
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id.toString()} order={order} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
