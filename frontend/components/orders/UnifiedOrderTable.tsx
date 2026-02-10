'use client';

import { useAccount } from 'wagmi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUnifiedOrders, type UnifiedOrder } from '@/hooks/useUnifiedOrders';
import { getChainConfig } from '@/lib/contracts/addresses';

interface UnifiedOrderTableProps {
  sourceChainId: number;
  targetChainId: number;
  sourceToken?: string;
  targetToken?: string;
  onMatchOrder: (order: UnifiedOrder) => void;
}

export function UnifiedOrderTable({
  sourceChainId,
  targetChainId,
  sourceToken,
  targetToken,
  onMatchOrder,
}: UnifiedOrderTableProps) {
  const { address } = useAccount();
  const { orders, isLoading } = useUnifiedOrders({
    sourceChainId,
    targetChainId,
    sourceToken,
    targetToken,
  });

  const sourceConfig = getChainConfig(sourceChainId);
  const targetConfig = getChainConfig(targetChainId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm text-gray-400">No orders found for this pair</p>
        <p className="text-xs text-gray-500 mt-1">Try a different token pair or create a new order</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-light-border dark:border-dark-border">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Price</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sell</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Buy</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Expires</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isOwnOrder = address?.toLowerCase() === order.creator.toLowerCase();
            const expiresAt = new Date(Number(order.expiresAt) * 1000);
            const timeLeft = expiresAt.getTime() - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
            const minsLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));

            return (
              <tr
                key={`${sourceChainId}-${order.id}`}
                className="border-b border-light-border/50 dark:border-dark-border/50 hover:bg-light-hover/50 dark:hover:bg-dark-hover/50 transition-colors"
              >
                <td className="py-3 px-4">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {order.price > 0 ? order.price.toFixed(6) : '—'}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">
                    {order.buySymbol}/{order.sellSymbol}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-sm text-gray-900 dark:text-white font-medium">
                    {parseFloat(order.formattedSellAmount).toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {order.sellSymbol}
                    <span className="ml-1" style={{ color: sourceConfig?.color }}>
                      {sourceConfig?.shortName}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-sm text-gray-900 dark:text-white font-medium">
                    {parseFloat(order.formattedBuyAmount).toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {order.buySymbol}
                    <span className="ml-1" style={{ color: targetConfig?.color }}>
                      {targetConfig?.shortName}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs font-mono text-gray-500">
                    {order.creator.slice(0, 6)}...{order.creator.slice(-4)}
                  </span>
                  {isOwnOrder && (
                    <Badge variant="info" className="ml-2">You</Badge>
                  )}
                </td>
                <td className="py-3 px-4">
                  {timeLeft > 0 ? (
                    <span className="text-xs text-gray-500">
                      {hoursLeft}h {minsLeft}m
                    </span>
                  ) : (
                    <Badge variant="error">Expired</Badge>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isOwnOrder || timeLeft <= 0}
                    onClick={() => onMatchOrder(order)}
                  >
                    Match
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
