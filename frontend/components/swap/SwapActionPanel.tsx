'use client';

import { useAccount, useChainId, usePublicClient, useSwitchChain } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getRequiredChain } from '@/lib/utils/swapPhase';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import type { ActiveSwap } from '@/types/swap';
import {
  WaitingMessage,
  OrderCreatedAction,
  CreatorLockAction,
  MatcherLockAction,
  CreatorWithdrawAction,
  MatcherWithdrawAction,
  SuiSourceMatcherWithdrawAction,
  SuiSourceCreatorClaimEvmAction,
  SuiSourceCreatorCounterHTLCAction,
  RefundAction,
  CompleteAction,
} from './actions/SwapActions';

/** Detected HTLC data shared with action sub-components. */
export interface DetectedHTLC {
  swapId: `0x${string}`;
  hashlock: `0x${string}`;
  timelock: bigint;
  amount: bigint;
  htlcObjectId?: string;
}

export interface SwapActionPanelProps {
  swap: ActiveSwap;
  onUpdate: () => void;
  detectedHTLC?: DetectedHTLC | null;
}

export function SwapActionPanel({ swap, onUpdate, detectedHTLC }: SwapActionPanelProps) {
  const evmChainId = useChainId();
  const suiAccount = useCurrentAccount();
  const { switchChainAsync } = useSwitchChain();
  const { meta, phase, orderStatus, expiresAt } = swap;
  const role = meta.role;

  // Check if order is in a terminal state (no actions available)
  const isTerminalState =
    orderStatus && ['Cancelled', 'Expired', 'Completed'].includes(orderStatus);

  // Check if order has expired locally (time-based)
  const isExpired = expiresAt && expiresAt <= BigInt(Math.floor(Date.now() / 1000));

  // Show badge only for terminal/expired states
  if (isTerminalState || isExpired) {
    const label = orderStatus === 'Cancelled' ? 'Cancelled'
      : orderStatus === 'Completed' ? 'Completed'
      : 'Expired';
    const variant = orderStatus === 'Completed' ? 'success' : 'default';
    return <Badge variant={variant}>{label}</Badge>;
  }

  const requiredChain = getRequiredChain(phase, role, meta);

  // Determine if user is on the correct chain
  let needsChainSwitch = false;
  if (requiredChain !== null) {
    if (typeof requiredChain === 'number') {
      needsChainSwitch = evmChainId !== requiredChain;
    } else if (typeof requiredChain === 'string' && requiredChain.includes('sui')) {
      needsChainSwitch = !suiAccount;
    }
  }

  const switchToRequired = async () => {
    if (requiredChain && typeof requiredChain === 'number') {
      await switchChainAsync({ chainId: requiredChain });
    }
  };

  // Show chain switch prompt if needed
  if (needsChainSwitch && requiredChain) {
    const chainName = chainConfig[requiredChain as SupportedChainId]?.shortName || `Chain ${requiredChain}`;

    if (typeof requiredChain === 'string' && requiredChain.includes('sui')) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-yellow-400">
            Connect a SUI wallet to continue
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-yellow-400">
          Switch to {chainName} to continue
        </p>
        <Button onClick={switchToRequired} size="sm" variant="primary">
          Switch to {chainName}
        </Button>
      </div>
    );
  }

  // Render the correct action for the current phase + role
  switch (phase) {
    case 'order_created':
      return <OrderCreatedAction swap={swap} onUpdate={onUpdate} detectedHTLC={detectedHTLC} />;
    case 'order_matched': {
      const isSuiSource = typeof meta.sourceChainId === 'string';
      if (role === 'creator') {
        if (isSuiSource) return <SuiSourceCreatorCounterHTLCAction swap={swap} onUpdate={onUpdate} />;
        return <CreatorLockAction swap={swap} onUpdate={onUpdate} />;
      }
      return <WaitingMessage text={isSuiSource
        ? "EVM HTLC locked. Waiting for order creator to create SUI counter-HTLC..."
        : "Waiting for the initiator to lock tokens..."} />;
    }
    case 'creator_htlc_created':
      if (role === 'matcher') return <MatcherLockAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for counterparty to lock tokens..." />;
    case 'matcher_htlc_created': {
      const isSuiSource = typeof meta.sourceChainId === 'string';
      if (isSuiSource) {
        if (role === 'matcher') return <SuiSourceMatcherWithdrawAction swap={swap} onUpdate={onUpdate} />;
        return <WaitingMessage text="Counterparty is withdrawing from your SUI HTLC to reveal the secret..." />;
      }
      if (role === 'creator') return <CreatorWithdrawAction swap={swap} onUpdate={onUpdate} detectedHTLC={detectedHTLC} />;
      return <WaitingMessage text="Waiting for the initiator to claim tokens..." />;
    }
    case 'secret_revealed': {
      const isSuiSource = typeof meta.sourceChainId === 'string';
      if (isSuiSource) {
        if (role === 'creator') return <SuiSourceCreatorClaimEvmAction swap={swap} onUpdate={onUpdate} />;
        return <WaitingMessage text="Secret revealed! Waiting for initiator to claim EVM tokens..." />;
      }
      if (role === 'matcher') return <MatcherWithdrawAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for counterparty to complete..." />;
    }
    case 'refundable':
      return <RefundAction swap={swap} onUpdate={onUpdate} />;
    case 'completed':
      return <CompleteAction swap={swap} onUpdate={onUpdate} />;
    case 'refunded':
      return <Badge variant="default">Refunded</Badge>;
    default:
      return null;
  }
}
