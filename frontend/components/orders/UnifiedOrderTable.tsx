'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAllOrders } from '@/hooks/useAllOrders';
import { useCancelSuiOrder } from '@/hooks/useSuiOrders';
import type { UnifiedOrder } from '@/hooks/useAllUnifiedOrdersFixed';
import { getChainConfig, getContractAddress, getExplorerTxUrl } from '@/lib/contracts/addresses';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { toast } from 'sonner';

interface UnifiedOrderTableProps {
  sourceChainId?: number | string;
  targetChainId?: number | string;
  sourceToken?: string;
  targetToken?: string;
  onMatchOrder: (order: UnifiedOrder, sourceChainId: number | string) => void;
}

export function UnifiedOrderTable({
  sourceChainId,
  targetChainId,
  sourceToken,
  targetToken,
  onMatchOrder,
}: UnifiedOrderTableProps) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const queryClient = useQueryClient();
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelTxHash, setCancelTxHash] = useState<`0x${string}` | undefined>();

  const { orders, isLoading, refetchSuiOrders } = useAllOrders({
    sourceChainId,
    targetChainId,
    sourceToken,
    targetToken,
  });

  // Use writeContract directly to handle cancellation for any chain dynamically
  const { writeContractAsync } = useWriteContract();

  // SUI order cancellation
  const { cancelOrder: cancelSuiOrder, isPending: isSuiCancelling } = useCancelSuiOrder();

  // Wait for cancellation transaction
  const { isLoading: isConfirming, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({
    hash: cancelTxHash,
  });

  // Invalidate caches when cancellation is confirmed
  useEffect(() => {
    if (isCancelSuccess && cancelTxHash) {
      console.log('✅ Order cancelled successfully, invalidating caches');
      queryClient.invalidateQueries({ queryKey: ['crossChainOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderBook'] });
      queryClient.invalidateQueries({ queryKey: ['userOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });

      toast.success('Order cancelled successfully!');
      setCancellingOrderId(null);
      setCancelTxHash(undefined);
    }
  }, [isCancelSuccess, cancelTxHash, queryClient]);

  // Log transaction confirmation status
  useEffect(() => {
    if (cancelTxHash) {
      console.log('⏳ Waiting for transaction confirmation...', {
        hash: cancelTxHash,
        isConfirming,
        isSuccess: isCancelSuccess,
      });
    }
  }, [cancelTxHash, isConfirming, isCancelSuccess]);

  const handleCancelOrder = async (order: UnifiedOrder) => {
    const orderKey = `${order.sourceChainIdNum}-${order.id}`;
    const isSuiOrder = order.sourceChainIdNum === 'sui:testnet';

    // Handle SUI order cancellation
    if (isSuiOrder) {
      if (!suiAccount) {
        toast.error('Please connect your SUI wallet');
        return;
      }

      setCancellingOrderId(orderKey);

      try {
        await cancelSuiOrder(order.id.toString());
        // Manually refetch SUI orders (useSuiOrders uses polling, not React Query)
        refetchSuiOrders();
        toast.success('SUI order cancelled successfully!');
        setCancellingOrderId(null);
      } catch (err: any) {
        console.error('❌ Cancel SUI order failed:', err);
        toast.error(err?.message || 'Failed to cancel SUI order');
        setCancellingOrderId(null);
      }
      return;
    }

    // Handle EVM order cancellation
    if (!address) return;

    const isSameChain = order.sourceChainIdNum === order.targetChainIdNum;
    const orderSourceChainId = order.sourceChainIdNum;

    // Check if need to switch chain
    if (chainId !== orderSourceChainId) {
      toast.error(`Please switch to ${getChainConfig(orderSourceChainId)?.shortName} network first`);
      switchChain?.({ chainId: orderSourceChainId });
      return;
    }

    setCancellingOrderId(orderKey);

    try {
      console.log('🗑️ Cancelling order:', {
        orderId: order.id.toString(),
        orderChainId: orderSourceChainId,
        isSameChain,
        currentChainId: chainId,
      });

      // Get the correct contract address for the ORDER'S chain (not the filter chain!)
      const contractAddress = (isSameChain
        ? getContractAddress(orderSourceChainId, 'orderBook')
        : getContractAddress(orderSourceChainId, 'crossChainOrderBook')) as `0x${string}`;

      const abi = isSameChain ? orderBookABI : CROSS_CHAIN_ORDER_BOOK_ABI;

      console.log('📝 Contract details:', {
        address: contractAddress,
        contractType: isSameChain ? 'OrderBook' : 'CrossChainOrderBook',
      });

      // Polygon Amoy requires higher gas prices
      const isPolygon = orderSourceChainId === 80002;
      const gasConfig = isPolygon
        ? {
            gas: 300000n,
            maxFeePerGas: 50000000000n, // 50 Gwei
            maxPriorityFeePerGas: 50000000000n, // 50 Gwei
          }
        : {
            gas: 300000n,
          };

      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: 'cancelOrder',
        args: [order.id],
        ...gasConfig,
      });

      console.log('✅ Cancel transaction submitted:', hash);

      // Get explorer URL for the transaction
      const explorerUrl = getExplorerTxUrl(orderSourceChainId, hash);
      console.log('🔗 Transaction URL:', explorerUrl);

      setCancelTxHash(hash);

      // Show toast with link to explorer
      toast.info(
        <div>
          Transaction submitted!
          <br />
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline text-xs mt-1 inline-block"
          >
            View on explorer →
          </a>
        </div>,
        { duration: 10000 }
      );

    } catch (err: any) {
      console.error('❌ Cancel order failed:', err);
      toast.error(err?.shortMessage || err?.message || 'Failed to cancel order');
      setCancellingOrderId(null);
    }
  };

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
        <p className="text-sm text-gray-400">No orders found</p>
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
            // Check if this is a SUI order (sourceChainIdNum is 'sui:testnet')
            const isSuiOrder = order.sourceChainIdNum === 'sui:testnet';

            // Check ownership: compare with SUI wallet for SUI orders, EVM wallet for EVM orders
            const isOwnOrder = isSuiOrder
              ? suiAccount?.address?.toLowerCase() === order.creator.toLowerCase()
              : address?.toLowerCase() === order.creator.toLowerCase();

            const isSameChain = order.sourceChainIdNum === order.targetChainIdNum;

            const expiresAt = new Date(Number(order.expiresAt) * 1000);
            const timeLeft = expiresAt.getTime() - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
            const minsLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));

            // Get chain configs for this specific order
            const sourceConfig = getChainConfig(order.sourceChainIdNum);
            const targetConfig = getChainConfig(order.targetChainIdNum);

            return (
              <tr
                key={`${order.sourceChainIdNum}-${order.id}`}
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
                  <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                    <span>{order.sellSymbol}</span>
                    {isSameChain ? (
                      <Badge variant="info" className="text-[10px] px-1 py-0">On-Chain</Badge>
                    ) : (
                      <span className="ml-1" style={{ color: sourceConfig?.color }}>
                        {sourceConfig?.shortName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-sm text-gray-900 dark:text-white font-medium">
                    {parseFloat(order.formattedBuyAmount).toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                    <span>{order.buySymbol}</span>
                    {!isSameChain && (
                      <span className="ml-1" style={{ color: targetConfig?.color }}>
                        {targetConfig?.shortName}
                      </span>
                    )}
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
                  {isSameChain ? (
                    <span className="text-xs text-gray-500">—</span>
                  ) : timeLeft > 0 ? (
                    <span className="text-xs text-gray-500">
                      {hoursLeft}h {minsLeft}m
                    </span>
                  ) : (
                    <Badge variant="error">Expired</Badge>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {isOwnOrder ? (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={cancellingOrderId === `${order.sourceChainIdNum}-${order.id}` || isConfirming}
                      disabled={cancellingOrderId !== null || isConfirming}
                      onClick={() => handleCancelOrder(order)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!isSameChain && timeLeft <= 0}
                      onClick={() => {
                        // sourceChainIdNum is already 'sui:testnet' for SUI orders
                        onMatchOrder(order, order.sourceChainIdNum);
                      }}
                    >
                      {isSameChain ? 'Execute' : 'Match'}
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
