'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMyOrders, useRefreshDexData } from '@/hooks/useDexApi';
import type { OrderDto } from '@/lib/api/dexApi';
import { cn } from '@/lib/utils/cn';

export function MyOrders() {
  const { isConnected } = useAccount();
  const suiAccount = useCurrentAccount();
  const hasWallet = isConnected || !!suiAccount;
  const { data: page, isLoading, isError, refetch } = useMyOrders();
  const refreshAll = useRefreshDexData();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const orders = page?.content || [];

  const filteredOrders =
    statusFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === statusFilter.toUpperCase());

  const statusCounts = {
    all: orders.length,
    active: orders.filter((o) => o.status === 'ACTIVE').length,
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
  };

  if (!hasWallet) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 mb-2">Connect your wallet</div>
          <p className="text-sm text-gray-400">Connect your wallet to view your orders</p>
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
            onClick={() => { refetch(); refreshAll(); }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {(['all', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === s
                  ? s === 'ACTIVE' ? 'bg-accent-green text-white'
                    : s === 'CANCELLED' ? 'bg-gray-500 text-white'
                    : 'bg-accent-blue text-white'
                  : 'bg-light-hover dark:bg-dark-hover text-gray-700 dark:text-gray-300'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()} ({statusCounts[s === 'all' ? 'all' : s.toLowerCase() as keyof typeof statusCounts] ?? 0})
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">Failed to load your orders</div>
            <button onClick={() => refetch()} className="text-accent-blue text-sm font-medium">Try again</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {statusFilter === 'all' ? "You haven't created any orders yet" : `No ${statusFilter.toLowerCase()} orders`}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Simple order row using backend OrderDto directly. */
function OrderRow({ order }: { order: OrderDto }) {
  const sourceChain = order.sourceChainId.includes(':') ? 'SUI' : order.sourceChainId === '11155111' ? 'Ethereum' : 'Polygon';
  const targetChain = order.targetChainId
    ? (order.targetChainId.includes(':') ? 'SUI' : order.targetChainId === '11155111' ? 'Ethereum' : 'Polygon')
    : sourceChain;

  return (
    <div className="p-4 rounded-xl bg-light-hover/50 dark:bg-dark-hover/50 border border-light-border dark:border-dark-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-500">#{order.onChainOrderId}</span>
          <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded',
            order.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
            order.status === 'MATCHED' ? 'bg-blue-500/10 text-blue-400' :
            order.status === 'COMPLETED' ? 'bg-gray-500/10 text-gray-400' :
            'bg-red-500/10 text-red-400'
          )}>
            {order.status}
          </span>
          <span className="text-xs text-gray-500">
            {sourceChain} {order.orderType === 'CROSS_CHAIN' ? `→ ${targetChain}` : ''}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="text-sm">
          <strong>{order.formattedSellAmount}</strong> {order.sellToken?.symbol || '???'}
        </span>
        <span className="text-gray-400">→</span>
        <span className="text-sm">
          <strong>{order.formattedBuyAmount}</strong> {order.buyToken?.symbol || '???'}
        </span>
      </div>
    </div>
  );
}
