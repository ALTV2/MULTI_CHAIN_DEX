'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/Button';
import { TokenIcon } from '@/components/common/TokenIcon';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { useExecuteOrder } from '@/hooks/useExecuteOrder';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { getContractAddress } from '@/lib/contracts/addresses';
import { formatTokenAmount, formatNumber } from '@/lib/utils/formatters';
import { isNativeToken } from '@/lib/constants/tokens';
import { toast } from 'sonner';
import type { OrderDisplay } from '@/types/order';

interface OrderRowProps {
  order: OrderDisplay;
}

export function OrderRow({ order }: OrderRowProps) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const [showDetails, setShowDetails] = useState(false);

  const tradeAddress = getContractAddress(chainId, 'trade');

  const isOwnOrder =
    userAddress &&
    order.creator.toLowerCase() === userAddress.toLowerCase();

  // Get balance for the token we need to pay
  const { balance: buyTokenBalance } = useTokenBalance(
    order.buyToken.address,
    order.buyToken.decimals
  );

  // Get approval for buy token (if ERC20)
  const { needsApproval, approve, isApproving, isApproved } =
    useTokenApproval(
      order.buyToken.address,
      tradeAddress,
      order.buyAmount
    );

  // Execute order mutation
  const { executeOrder, isExecuting, isSuccess, error, reset } =
    useExecuteOrder();

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      toast.success('Order executed successfully!');
      reset();
    }
  }, [isSuccess, reset]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleExecute = async () => {
    try {
      // Check balance
      if (buyTokenBalance < order.buyAmount) {
        toast.error('Insufficient balance to execute order');
        return;
      }

      // If needs approval, approve first
      if (needsApproval) {
        toast.info('Approving token...');
        await approve();
        toast.success('Token approved!');
      }

      // Execute order
      toast.info('Executing order...');
      await executeOrder({
        orderId: order.id,
        tokenToBuy: order.buyToken.address,
        buyAmount: order.buyAmount,
      });
    } catch (err: any) {
      console.error('Error executing order:', err);
    }
  };

  const canExecute =
    userAddress &&
    !isOwnOrder &&
    buyTokenBalance >= order.buyAmount;

  return (
    <div className="border border-light-border dark:border-dark-border rounded-xl p-4 hover:bg-light-hover dark:hover:bg-dark-hover/50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Sell Info */}
          <div className="flex items-center gap-2">
            <TokenIcon token={order.sellToken} size="sm" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
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
          <div className="hidden md:flex justify-center">
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

          {/* Buy Info */}
          <div className="flex items-center gap-2">
            <TokenIcon token={order.buyToken} size="sm" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
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

          {/* Rate */}
          <div className="hidden md:block text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatNumber(order.rate, 6)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {order.buyToken.symbol}/{order.sellToken.symbol}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {isOwnOrder ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 px-3 py-1.5 bg-light-hover dark:bg-dark-hover rounded-lg">
              Your Order
            </div>
          ) : needsApproval && !isApproved ? (
            <Button
              size="sm"
              onClick={() => approve()}
              loading={isApproving}
              disabled={!canExecute || isApproving}
            >
              Approve
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleExecute}
              loading={isExecuting}
              disabled={!canExecute || isExecuting}
            >
              Execute
            </Button>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
      </div>

      {/* Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Order ID:</span>
            <span className="font-mono text-gray-900 dark:text-white">
              #{order.id.toString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Creator:</span>
            <AddressDisplay address={order.creator} chars={6} />
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
  );
}
