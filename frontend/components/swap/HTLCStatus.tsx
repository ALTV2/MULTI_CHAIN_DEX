'use client';

import { useMemo } from 'react';
import { formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { chainConfig, SupportedChainId, getExplorerAddressUrl } from '@/lib/contracts/addresses';
import { useHTLCSwap, SwapStatus } from '@/hooks/useHTLC';

interface HTLCStatusProps {
  chainId: number;
  swapId: `0x${string}`;
  onWithdraw?: () => void;
  onRefund?: () => void;
  isParticipant?: boolean;
  isInitiator?: boolean;
}

export function HTLCStatus({
  chainId,
  swapId,
  onWithdraw,
  onRefund,
  isParticipant = false,
  isInitiator = false,
}: HTLCStatusProps) {
  const { swap, isLoading, error } = useHTLCSwap(chainId, swapId);
  const config = chainConfig[chainId as SupportedChainId];

  const timeRemaining = useMemo(() => {
    if (!swap?.timelock) return null;

    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = swap.timelock - now;

    if (remaining <= BigInt(0)) return 'Expired';

    const hours = Number(remaining) / 3600;
    if (hours < 1) {
      const minutes = Math.floor(Number(remaining) / 60);
      return `${minutes} min`;
    }
    if (hours < 24) {
      return `${Math.floor(hours)} hours`;
    }
    return `${Math.floor(hours / 24)} days`;
  }, [swap?.timelock]);

  const isExpired = useMemo(() => {
    if (!swap?.timelock) return false;
    return BigInt(Math.floor(Date.now() / 1000)) > swap.timelock;
  }, [swap?.timelock]);

  const statusVariant: Record<SwapStatus, 'success' | 'warning' | 'default'> = {
    Empty: 'default',
    Active: 'warning',
    Withdrawn: 'success',
    Refunded: 'default',
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-gray-700 rounded" />
          <div className="h-20 bg-gray-700 rounded" />
          <div className="h-10 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  if (error || !swap) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-400">
          <p>Failed to load HTLC status</p>
          {error && <p className="text-sm text-red-400 mt-2">{error.message}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config?.color }}
          />
          <h3 className="font-semibold">{config?.shortName} HTLC</h3>
        </div>
        <Badge variant={statusVariant[swap.status]}>
          {swap.status}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50">
          <span className="text-sm text-gray-400">Amount</span>
          <span className="font-semibold">
            {formatEther(swap.amount)} {config?.nativeCurrency.symbol}
          </span>
        </div>

        <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50">
          <span className="text-sm text-gray-400">Timelock</span>
          <div className="text-right">
            <span className={`font-semibold ${isExpired ? 'text-red-400' : ''}`}>
              {timeRemaining}
            </span>
            <p className="text-xs text-gray-500">
              {new Date(Number(swap.timelock) * 1000).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-gray-800/50">
          <p className="text-sm text-gray-400 mb-1">Initiator</p>
          <a
            href={getExplorerAddressUrl(chainId, swap.initiator)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-blue-400 hover:text-blue-300 truncate block"
          >
            {swap.initiator}
          </a>
        </div>

        <div className="p-3 rounded-lg bg-gray-800/50">
          <p className="text-sm text-gray-400 mb-1">Participant</p>
          <a
            href={getExplorerAddressUrl(chainId, swap.participant)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-blue-400 hover:text-blue-300 truncate block"
          >
            {swap.participant}
          </a>
        </div>

        <div className="p-3 rounded-lg bg-gray-800/50">
          <p className="text-sm text-gray-400 mb-1">Hashlock</p>
          <p className="text-xs font-mono text-gray-300 truncate">{swap.hashlock}</p>
        </div>
      </div>

      {/* Actions */}
      {swap.status === 'Active' && (
        <div className="space-y-2">
          {isParticipant && !isExpired && onWithdraw && (
            <Button
              className="w-full"
              variant="primary"
              onClick={onWithdraw}
            >
              Withdraw with Secret
            </Button>
          )}

          {isInitiator && isExpired && onRefund && (
            <Button
              className="w-full"
              variant="secondary"
              onClick={onRefund}
            >
              Refund (Timelock Expired)
            </Button>
          )}

          {!isExpired && (
            <p className="text-xs text-center text-gray-500">
              {isParticipant
                ? 'Enter the secret to withdraw funds'
                : 'Waiting for participant to withdraw or timelock to expire'}
            </p>
          )}
        </div>
      )}

      {/* Completed States */}
      {swap.status === 'Withdrawn' && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-sm text-green-400">Funds have been withdrawn successfully</p>
        </div>
      )}

      {swap.status === 'Refunded' && (
        <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20 text-center">
          <p className="text-sm text-gray-400">Funds have been refunded to initiator</p>
        </div>
      )}
    </Card>
  );
}
