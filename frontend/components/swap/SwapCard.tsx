'use client';

import { useMemo } from 'react';
import { formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SwapStepper } from './SwapStepper';
import { SwapActionPanel } from './SwapActionPanel';
import { getPhaseDescription } from '@/lib/utils/swapPhase';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import type { ActiveSwap } from '@/types/swap';

function getTimelockCountdown(timelock: bigint | undefined): string {
  if (!timelock) return '--';
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(timelock) - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getPhaseBadgeVariant(phase: string): 'success' | 'warning' | 'default' {
  switch (phase) {
    case 'completed': return 'success';
    case 'refundable':
    case 'refunded': return 'warning';
    default: return 'default';
  }
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    order_created: 'Awaiting Match',
    order_matched: 'Matched',
    creator_htlc_created: 'Creator Locked',
    matcher_htlc_created: 'Both Locked',
    secret_revealed: 'Secret Revealed',
    completed: 'Completed',
    refundable: 'Refundable',
    refunded: 'Refunded',
  };
  return labels[phase] || phase;
}

interface SwapCardProps {
  swap: ActiveSwap;
  onUpdate: () => void;
}

export function SwapCard({ swap, onUpdate }: SwapCardProps) {
  const { meta, phase } = swap;

  const sourceConfig = chainConfig[meta.sourceChainId as SupportedChainId];
  const targetConfig = chainConfig[meta.targetChainId as SupportedChainId];
  const sellSymbol = getTokenByAddress(meta.sourceChainId, meta.sellToken as `0x${string}`)?.symbol || 'Token';
  const buySymbol = getTokenByAddress(meta.targetChainId, meta.buyToken as `0x${string}`)?.symbol || 'Token';
  const description = getPhaseDescription(phase, meta.role);

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={getPhaseBadgeVariant(phase)}>
            {getPhaseLabel(phase)}
          </Badge>
          <Badge variant="default">
            {meta.role === 'creator' ? 'Creator' : 'Matcher'}
          </Badge>
          <span className="text-xs text-gray-500">Order #{meta.orderId}</span>
        </div>
      </div>

      {/* Chain flow */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${sourceConfig?.color}20`, color: sourceConfig?.color }}
        >
          {sourceConfig?.shortName}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${targetConfig?.color}20`, color: targetConfig?.color }}
        >
          {targetConfig?.shortName}
        </span>
      </div>

      {/* Token amounts */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Selling</p>
          <p className="text-base font-semibold">
            {formatEther(BigInt(meta.sellAmount))} {sellSymbol}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">For</p>
          <p className="text-base font-semibold">
            {formatEther(BigInt(meta.buyAmount))} {buySymbol}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <SwapStepper phase={phase} />

      {/* Phase description */}
      <p className="text-sm text-gray-400 mb-4">{description}</p>

      {/* Timelocks */}
      {(swap.creatorHtlcTimelock || swap.matcherHtlcTimelock) && (
        <div className="flex gap-4 mb-4 text-xs text-gray-500">
          {swap.creatorHtlcTimelock && (
            <div>
              Creator HTLC: <span className="text-gray-300">{getTimelockCountdown(swap.creatorHtlcTimelock)}</span>
            </div>
          )}
          {swap.matcherHtlcTimelock && (
            <div>
              Matcher HTLC: <span className="text-gray-300">{getTimelockCountdown(swap.matcherHtlcTimelock)}</span>
            </div>
          )}
        </div>
      )}

      {/* Action panel */}
      <SwapActionPanel swap={swap} onUpdate={onUpdate} />
    </Card>
  );
}
