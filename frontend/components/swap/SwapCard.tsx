'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SwapStepper } from './SwapStepper';
import { SwapActionPanel } from './SwapActionPanel';
import { getPhaseDescription } from '@/lib/utils/swapPhase';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { formatAmount } from '@/lib/utils/formatAmount';
import { useDetectCrossChainHTLC } from '@/hooks/useDetectCrossChainHTLC';
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

function getPhaseBadgeVariant(phase: string): 'success' | 'warning' | 'error' | 'default' {
  switch (phase) {
    case 'completed': return 'success';
    case 'refundable':
    case 'refunded': return 'error';
    default: return 'default';
  }
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    order_created: 'Open',
    order_matched: 'Matched',
    creator_htlc_created: 'Locking (1/2)',
    matcher_htlc_created: 'Locked',
    secret_revealed: 'Claiming',
    completed: 'Completed',
    refundable: '⚠️ Trade Failed',
    refunded: '⚠️ Refunded',
  };
  return labels[phase] || phase;
}

interface SwapCardProps {
  swap: ActiveSwap;
  onUpdate: () => void;
}

export function SwapCard({ swap, onUpdate }: SwapCardProps) {
  const { meta, phase } = swap;
  const { address } = useAccount(); // EVM wallet

  const isSameChain = meta.sourceChainId === meta.targetChainId;
  const isFailed = phase === 'refundable' || phase === 'refunded';
  const sourceConfig = chainConfig[meta.sourceChainId as SupportedChainId];
  const targetConfig = chainConfig[meta.targetChainId as SupportedChainId];
  const sellSymbol = getTokenByAddress(meta.sourceChainId, meta.sellToken as `0x${string}`)?.symbol || 'Token';
  const buySymbol = getTokenByAddress(meta.targetChainId, meta.buyToken as `0x${string}`)?.symbol || 'Token';
  const description = getPhaseDescription(phase, meta.role);

  // Auto-detect HTLC for SUI → EVM orders in "order_created" phase
  const isSuiSource = typeof meta.sourceChainId === 'string' && meta.sourceChainId.includes('sui');
  const isEvmTarget = typeof meta.targetChainId === 'number';

  // CRITICAL: For detection, use EVM address if connected (creator needs EVM address to receive tokens)
  // If only SUI wallet, detection won't work (creator address is SUI, but HTLC participant must be EVM)
  const detectionAddress = address || meta.creator; // Prefer EVM address if available
  const canDetect = isSuiSource && isEvmTarget && address; // Require EVM wallet for detection

  const shouldDetect = canDetect && phase === 'order_created' && meta.role === 'creator';

  // Debug logging
  console.log('[SwapCard] Auto-detection setup:', {
    orderId: meta.orderId,
    sourceChainId: meta.sourceChainId,
    targetChainId: meta.targetChainId,
    phase,
    role: meta.role,
    creator: meta.creator,
    evmAddress: address,
    detectionAddress,
    isSuiSource,
    isEvmTarget,
    canDetect,
    shouldDetect,
  });

  const { detectedHTLC, isDetecting } = useDetectCrossChainHTLC({
    orderId: meta.orderId,
    sourceChainId: meta.sourceChainId,
    targetChainId: meta.targetChainId,
    creatorAddress: detectionAddress || '',
    enabled: shouldDetect,
  });

  // Debug detected HTLC
  if (detectedHTLC) {
    console.log('🎉 [SwapCard] HTLC detected!', detectedHTLC);
  }

  return (
    <Card className={`p-5 ${isFailed ? 'border-2 border-accent-red/50 bg-accent-red/5' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={getPhaseBadgeVariant(phase)}>
            {getPhaseLabel(phase)}
          </Badge>
          {isSameChain && (
            <Badge variant="info">On-Chain</Badge>
          )}
          <Badge variant="default">
            {meta.role === 'creator' ? 'Initiator' : 'Counterparty'}
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
        {!isSameChain && (
          <>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${targetConfig?.color}20`, color: targetConfig?.color }}
            >
              {targetConfig?.shortName}
            </span>
          </>
        )}
      </div>

      {/* Token amounts */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Selling</p>
          <p className="text-base font-semibold">
            {formatAmount(meta.sellAmount, meta.sourceChainId, undefined, meta.sourceChainId)} {sellSymbol}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">For</p>
          <p className="text-base font-semibold">
            {formatAmount(meta.buyAmount, meta.targetChainId, undefined, meta.sourceChainId)} {buySymbol}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <SwapStepper phase={phase} isSameChain={isSameChain} />

      {/* Auto-detected HTLC notification */}
      {detectedHTLC && (
        <div className="mb-4 rounded-lg px-3 py-2 bg-accent-green/10 border border-accent-green/30">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-accent-green">Match Detected!</span>
          </div>
          <p className="text-sm text-gray-300">
            Someone matched your order and created HTLC on {targetConfig?.shortName}. You can now create your counter-HTLC on {sourceConfig?.shortName} to complete the swap.
          </p>
        </div>
      )}

      {/* Phase description */}
      <div className={`text-sm mb-4 rounded-lg px-3 py-2 ${
        isFailed
          ? 'bg-accent-red/10 text-accent-red border border-accent-red/30'
          : isDetecting
          ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30'
          : 'text-gray-400'
      }`}>
        {isFailed && (
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">Trade Failed</span>
          </div>
        )}
        {isDetecting && (
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-semibold">Checking for matches...</span>
          </div>
        )}
        {description}
      </div>

      {/* Timelocks */}
      {(swap.creatorHtlcTimelock || swap.matcherHtlcTimelock) && (
        <div className="flex gap-4 mb-4 text-xs text-gray-500">
          {swap.creatorHtlcTimelock && (
            <div>
              {meta.role === 'creator' ? 'Your lock' : 'Counterparty lock'}:{' '}
              <span className="text-gray-300">{getTimelockCountdown(swap.creatorHtlcTimelock)}</span>
            </div>
          )}
          {swap.matcherHtlcTimelock && (
            <div>
              {meta.role === 'matcher' ? 'Your lock' : 'Counterparty lock'}:{' '}
              <span className="text-gray-300">{getTimelockCountdown(swap.matcherHtlcTimelock)}</span>
            </div>
          )}
        </div>
      )}

      {/* Action panel */}
      <SwapActionPanel swap={swap} onUpdate={onUpdate} detectedHTLC={detectedHTLC} />
    </Card>
  );
}
