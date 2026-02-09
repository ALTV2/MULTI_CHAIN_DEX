'use client';

import { useState } from 'react';
import { useChainId, useAccount, useSwitchChain } from 'wagmi';
import { formatEther, keccak256, encodePacked } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId, contractAddresses } from '@/lib/contracts/addresses';
import {
  useCrossChainOrdersForTarget,
  useMatchCrossChainOrder,
  CrossChainOrder,
} from '@/hooks/useCrossChainOrders';
import { saveSwap, getSwap } from '@/lib/utils/swapStorage';
import type { StoredSwapMeta } from '@/types/swap';

// Resolve token symbol from address
function getTokenSymbol(tokenAddress: string, chainId: number): string {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return chainConfig[chainId as SupportedChainId]?.nativeCurrency.symbol || 'ETH';
  }
  const addresses = contractAddresses[chainId as SupportedChainId];
  if (!addresses) return 'Token';
  const isAmoy = chainId === 80002;
  if (tokenAddress.toLowerCase() === addresses.testTokenA.toLowerCase()) return isAmoy ? 'pTka' : 'TKA';
  if (tokenAddress.toLowerCase() === addresses.testTokenB.toLowerCase()) return isAmoy ? 'pTkb' : 'TKB';
  return 'Token';
}

export function CrossChainOrderList() {
  const chainId = useChainId();

  // Get orders from all other chains targeting current chain
  const otherChains = supportedChains.filter((c) => c.id !== chainId);

  return (
    <div className="space-y-6">
      {otherChains.map((sourceChain) => (
        <OrdersFromChain
          key={sourceChain.id}
          sourceChainId={sourceChain.id}
          targetChainId={chainId}
        />
      ))}
    </div>
  );
}

function OrdersFromChain({
  sourceChainId,
  targetChainId,
}: {
  sourceChainId: number;
  targetChainId: number;
}) {
  const { orders, isLoading, error, refetch } = useCrossChainOrdersForTarget(sourceChainId, targetChainId);

  const sourceConfig = chainConfig[sourceChainId as SupportedChainId];
  const targetConfig = chainConfig[targetChainId as SupportedChainId];

  if (error) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-red-400 text-sm">
            Failed to load orders from {sourceConfig?.name}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="px-2 py-1 rounded text-sm font-medium"
          style={{ backgroundColor: `${sourceConfig?.color}20`, color: sourceConfig?.color }}
        >
          {sourceConfig?.shortName}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span
          className="px-2 py-1 rounded text-sm font-medium"
          style={{ backgroundColor: `${targetConfig?.color}20`, color: targetConfig?.color }}
        >
          {targetConfig?.shortName}
        </span>
        <span className="text-gray-400 text-sm ml-auto">
          {orders.length} active order{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No active orders from {sourceConfig?.name}
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id.toString()}
              order={order}
              sourceChainId={sourceChainId}
              sourceConfig={sourceConfig}
              targetConfig={targetConfig}
              onMatched={() => refetch()}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function OrderCard({
  order,
  sourceChainId,
  sourceConfig,
  targetConfig,
  onMatched,
}: {
  order: CrossChainOrder;
  sourceChainId: number;
  sourceConfig: (typeof chainConfig)[SupportedChainId] | undefined;
  targetConfig: (typeof chainConfig)[SupportedChainId] | undefined;
  onMatched: () => void;
}) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { matchOrder, isPending, isConfirming, isSuccess, error } = useMatchCrossChainOrder(sourceChainId);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const expiresAt = new Date(Number(order.expiresAt) * 1000);
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  const sellTokenName = getTokenSymbol(order.sellToken, sourceChainId);
  const buyTokenName = getTokenSymbol(order.buyToken, Number(order.targetChainId));

  const isOwnOrder = address?.toLowerCase() === order.creator.toLowerCase();

  const handleMatch = async () => {
    if (!address) return;
    setIsMatching(true);
    setMatchError(null);

    try {
      // Save to localStorage BEFORE chain switch (component may unmount after switch)
      const orderId = order.id.toString();
      if (!getSwap(address, orderId, sourceChainId)) {
        const swapMeta: StoredSwapMeta = {
          orderId,
          role: 'matcher',
          sourceChainId,
          targetChainId: Number(order.targetChainId),
          hashlock: '',
          sellToken: order.sellToken,
          sellAmount: order.sellAmount.toString(),
          buyToken: order.buyToken,
          buyAmount: order.buyAmount.toString(),
          creator: order.creator,
          matcher: address,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveSwap(address, swapMeta);
      }

      // Need to be on the source chain to call matchOrder
      if (chainId !== sourceChainId) {
        await switchChainAsync({ chainId: sourceChainId });
      }

      // Generate a placeholder HTLC swap ID
      const htlcSwapId = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256'],
          [address, order.id, BigInt(Date.now())]
        )
      );

      await matchOrder(order.id, htlcSwapId);
      onMatched();
    } catch (err: any) {
      console.error('Failed to match order:', err);
      setMatchError(err?.shortMessage || err?.message || 'Failed to match order');
    } finally {
      setIsMatching(false);
    }
  };

  const isButtonDisabled = isPending || isConfirming || isMatching || isOwnOrder;

  return (
    <div className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Badge variant={order.status === 'Active' ? 'success' : 'default'}>
            {order.status}
          </Badge>
          <span className="text-sm text-gray-400">
            Order #{order.id.toString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpiringSoon && (
            <Badge variant="warning">Expires Soon</Badge>
          )}
          {isOwnOrder && (
            <Badge variant="default">Your Order</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Selling</p>
          <p className="text-lg font-semibold">
            {formatEther(order.sellAmount)} {sellTokenName}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">For</p>
          <p className="text-lg font-semibold">
            {formatEther(order.buyAmount)} {buyTokenName}
          </p>
        </div>
      </div>

      {/* Rate */}
      <div className="text-xs text-gray-500 mb-3">
        Rate: 1 {sellTokenName} = {(Number(formatEther(order.buyAmount)) / Number(formatEther(order.sellAmount))).toFixed(6)} {buyTokenName}
      </div>

      {/* Error */}
      {(matchError || error) && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs mb-3">
          {matchError || error?.message}
        </div>
      )}

      {/* Success */}
      {isSuccess && (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs mb-3">
          Order matched successfully!
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Expires: {expiresAt.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          {chainId !== sourceChainId && !isOwnOrder && (
            <span className="text-xs text-yellow-400">
              Will switch to {sourceConfig?.shortName}
            </span>
          )}
          <Button
            size="sm"
            variant="primary"
            disabled={isButtonDisabled}
            onClick={handleMatch}
          >
            {isPending || isConfirming || isMatching
              ? 'Matching...'
              : isOwnOrder
              ? 'Your Order'
              : 'Match Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
