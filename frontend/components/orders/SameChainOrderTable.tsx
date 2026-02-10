'use client';

import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { TokenIcon } from '@/components/common/TokenIcon';
import { useOrderBook } from '@/hooks/useOrderBook';
import { useExecuteOrder } from '@/hooks/useExecuteOrder';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import type { OrderDisplay } from '@/types/order';

interface SameChainOrderTableProps {
  chainId: number;
  sourceToken?: string;
  targetToken?: string;
}

export function SameChainOrderTable({
  chainId,
  sourceToken,
  targetToken,
}: SameChainOrderTableProps) {
  const { address } = useAccount();
  const { orders, isLoading } = useOrderBook();
  const { t } = useTranslation();
  const { executeOrder, isExecuting } = useExecuteOrder();

  // Filter orders by selected token pair
  const filteredOrders = orders.filter((order) => {
    if (sourceToken && order.tokenToSell.toLowerCase() !== sourceToken.toLowerCase()) return false;
    if (targetToken && order.tokenToBuy.toLowerCase() !== targetToken.toLowerCase()) return false;
    return true;
  });

  async function handleExecute(order: OrderDisplay) {
    try {
      await executeOrder({
        orderId: order.id,
        tokenToBuy: order.tokenToBuy,
        buyAmount: order.buyAmount,
      });
      toast.success('Order executed!');
    } catch (err: any) {
      toast.error(err?.message || 'Execution failed');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (filteredOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm text-gray-400">{t('orders.table.empty')}</p>
        <p className="text-xs text-gray-500 mt-1">{t('orders.table.emptyDesc')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-dark-border">
            <th className="text-left pb-3 font-medium">{t('orders.table.sell')}</th>
            <th className="text-left pb-3 font-medium">{t('orders.table.buy')}</th>
            <th className="text-right pb-3 font-medium">{t('orders.table.price')}</th>
            <th className="text-left pb-3 font-medium">{t('orders.table.creator')}</th>
            <th className="text-right pb-3 font-medium">{t('orders.table.action')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-light-border dark:divide-dark-border">
          {filteredOrders.map((order) => {
            const isOwn = address && order.creator.toLowerCase() === address.toLowerCase();
            return (
              <tr key={order.id.toString()} className="hover:bg-light-hover/30 dark:hover:bg-dark-hover/30 transition-colors">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <TokenIcon symbol={order.sellToken.symbol} logoURI={order.sellToken.logoURI} size="sm" />
                    <div>
                      <span className="font-medium text-sm">
                        {formatUnits(order.sellAmount, order.sellToken.decimals)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">{order.sellToken.symbol}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <TokenIcon symbol={order.buyToken.symbol} logoURI={order.buyToken.logoURI} size="sm" />
                    <div>
                      <span className="font-medium text-sm">
                        {formatUnits(order.buyAmount, order.buyToken.decimals)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">{order.buyToken.symbol}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-right">
                  <span className="text-sm font-mono">
                    {order.rate.toFixed(4)}
                  </span>
                </td>
                <td className="py-3">
                  {isOwn ? (
                    <Badge variant="outline">{t('orders.table.you')}</Badge>
                  ) : (
                    <span className="text-xs text-gray-400 font-mono">
                      {order.creator.slice(0, 6)}...{order.creator.slice(-4)}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {isOwn ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleExecute(order)}
                      loading={isExecuting}
                    >
                      {t('orders.table.execute')}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
