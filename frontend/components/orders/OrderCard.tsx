'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TokenIcon } from '@/components/common/TokenIcon';
import { useCancelOrder } from '@/hooks/useCancelOrder';
import { formatTokenAmount, formatNumber } from '@/lib/utils/formatters';
import { getOrderStatusLabel, getOrderStatusColor, OrderStatus } from '@/types/order';
import { toast } from 'sonner';
import type { OrderDisplay } from '@/types/order';

interface OrderCardProps {
  order: OrderDisplay;
}

export function OrderCard({ order }: OrderCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { cancelOrder, isCancelling, isSuccess, error, reset } =
    useCancelOrder();

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      toast.success('Order cancelled successfully!');
      reset();
    }
  }, [isSuccess, reset]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleCancel = async () => {
    if (
      !confirm(
        'Are you sure you want to cancel this order? Your tokens will be returned.'
      )
    ) {
      return;
    }

    try {
      toast.info('Cancelling order...');
      await cancelOrder(order.id);
    } catch (err: any) {
      console.error('Error cancelling order:', err);
    }
  };

  const canCancel = order.status === OrderStatus.Active;

  return (
    <div className="border border-light-border dark:border-dark-border rounded-xl p-4 hover:bg-light-hover dark:hover:bg-dark-hover/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                #{order.id.toString()}
              </span>
              <Badge className={getOrderStatusColor(order.status)}>
                {getOrderStatusLabel(order.status)}
              </Badge>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  showDetails ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Trade Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sell */}
            <div className="flex items-center gap-2">
              <TokenIcon token={order.sellToken} size="sm" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTokenAmount(
                    order.sellAmount,
                    order.sellToken.decimals,
                    4
                  )}{' '}
                  {order.sellToken.symbol}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Selling
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </div>

            {/* Buy */}
            <div className="flex items-center gap-2">
              <TokenIcon token={order.buyToken} size="sm" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTokenAmount(
                    order.buyAmount,
                    order.buyToken.decimals,
                    4
                  )}{' '}
                  {order.buyToken.symbol}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Buying
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          {showDetails && (
            <div className="pt-3 border-t border-light-border dark:border-dark-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Rate:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatNumber(order.rate, 6)} {order.buyToken.symbol}/
                  {order.sellToken.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Inverse Rate:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatNumber(order.inverseRate, 6)} {order.sellToken.symbol}/
                  {order.buyToken.symbol}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        {canCancel && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleCancel}
            loading={isCancelling}
            disabled={isCancelling}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
