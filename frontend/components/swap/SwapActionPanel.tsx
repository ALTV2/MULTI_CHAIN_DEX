'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCreateHTLCSwap, useWithdrawHTLC, useRefundHTLC, generateSecret, generateHashlock, generateSwapId } from '@/hooks/useHTLC';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useCompleteOrder } from '@/hooks/useCompleteOrder';
import { useSwapSecretFromEvent } from '@/hooks/useSwapSecretFromEvent';
import { updateSwap } from '@/lib/utils/swapStorage';
import { getRequiredChain } from '@/lib/utils/swapPhase';
import { getContractAddress, chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import { isNativeToken } from '@/lib/constants/tokens';
import { getSecretStrategy } from '@/lib/secrets';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { buildSwapKey } from '@/lib/secrets/SecretStorageStrategy';
import type { ActiveSwap } from '@/types/swap';

interface SwapActionPanelProps {
  swap: ActiveSwap;
  onUpdate: () => void;
}

export function SwapActionPanel({ swap, onUpdate }: SwapActionPanelProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { meta, phase } = swap;
  const role = meta.role;

  const requiredChain = getRequiredChain(phase, role, meta);
  const needsChainSwitch = requiredChain !== null && chainId !== requiredChain;

  const switchToRequired = async () => {
    if (requiredChain) {
      await switchChainAsync({ chainId: requiredChain });
    }
  };

  // Show chain switch prompt if needed
  if (needsChainSwitch && requiredChain) {
    const chainName = chainConfig[requiredChain as SupportedChainId]?.shortName || `Chain ${requiredChain}`;
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
      return <OrderCreatedAction swap={swap} />;
    case 'order_matched':
      if (role === 'creator') return <CreatorLockAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for the creator to lock tokens..." />;
    case 'creator_htlc_created':
      if (role === 'matcher') return <MatcherLockAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for the matcher to lock tokens..." />;
    case 'matcher_htlc_created':
      if (role === 'creator') return <CreatorWithdrawAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for the creator to reveal the secret..." />;
    case 'secret_revealed':
      if (role === 'matcher') return <MatcherWithdrawAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for the matcher to withdraw..." />;
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

function WaitingMessage({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {text}
    </div>
  );
}

function OrderCreatedAction({ swap }: { swap: ActiveSwap }) {
  return (
    <div className="text-sm text-gray-400">
      {swap.meta.role === 'creator'
        ? 'Your order is active and visible to counterparties. Waiting for a match...'
        : 'This order is available for matching.'}
    </div>
  );
}

/**
 * Creator locks tokens in HTLC on source chain (48h timelock)
 */
function CreatorLockAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approving' | 'locking' | 'done'>('idle');

  const sourceChainId = meta.sourceChainId;
  const htlcAddress = getContractAddress(sourceChainId, 'htlc');
  const sellAmount = BigInt(meta.sellAmount);
  const sellToken = meta.sellToken as `0x${string}`;
  const isNative = isNativeToken(sellToken);

  const { needsApproval, approve, isApproving, isApproved } = useTokenApproval(
    isNative ? undefined : sellToken,
    htlcAddress,
    sellAmount
  );

  const { createSwap, isPending: isCreating, isConfirming, isSuccess } = useCreateHTLCSwap(sourceChainId);

  useEffect(() => {
    if (isSuccess) {
      setStep('done');
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  const handleLock = async () => {
    if (!address) return;

    // If matcher not yet known, trigger refresh
    if (!meta.matcher) {
      setError('Matcher address not yet synced. Click Refresh and try again.');
      onUpdate();
      return;
    }

    setError(null);

    try {
      // Step 1: Generate secret and save BEFORE submitting tx
      let secret = meta.secret as `0x${string}` | undefined;
      let hashlock = meta.hashlock as `0x${string}`;

      if (!secret) {
        secret = generateSecret();
        hashlock = generateHashlock(secret);
        // CRITICAL: Save secret BEFORE creating HTLC
        updateSwap(address, meta.orderId, { secret, hashlock }, meta.sourceChainId);

        // Also persist via the user's chosen secret storage strategy
        const strategy = getSecretStrategy(useSettingsStore.getState().secretStorage);
        const swapKey = buildSwapKey(address, meta.orderId, meta.sourceChainId);
        await strategy.saveSecret(swapKey, secret);
      }

      // Step 2: Approve if needed
      if (needsApproval && !isApproved) {
        setStep('approving');
        await approve();
      }

      // Step 3: Create HTLC with 48h timelock
      setStep('locking');
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 48 * 3600);
      const swapId = generateSwapId(
        address,
        meta.matcher as `0x${string}`,
        hashlock,
        timelock,
        sourceChainId
      );

      // Save swapId before tx
      updateSwap(address, meta.orderId, { creatorHtlcSwapId: swapId }, meta.sourceChainId);

      await createSwap({
        swapId,
        participant: meta.matcher as `0x${string}`,
        hashlock,
        timelock,
        token: sellToken,
        amount: sellAmount,
      });
    } catch (err: any) {
      console.error('Creator lock failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to lock tokens');
      setStep('idle');
    }
  };

  if (!meta.matcher) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-yellow-400">Syncing matcher info from blockchain...</p>
        <Button size="sm" variant="secondary" onClick={onUpdate}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      {step === 'done' || isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Tokens locked in HTLC successfully!
        </div>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={isApproving || isCreating || isConfirming}
          onClick={handleLock}
          disabled={isApproving || isCreating || isConfirming}
        >
          {isApproving
            ? 'Approving...'
            : isCreating || isConfirming
            ? 'Locking Tokens...'
            : needsApproval
            ? 'Approve & Lock Tokens'
            : 'Lock Tokens in HTLC'}
        </Button>
      )}
    </div>
  );
}

/**
 * Matcher locks tokens in HTLC on target chain (24h timelock)
 */
function MatcherLockAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approving' | 'locking' | 'done'>('idle');

  const targetChainId = meta.targetChainId;
  const htlcAddress = getContractAddress(targetChainId, 'htlc');
  const buyAmount = BigInt(meta.buyAmount);
  const buyToken = meta.buyToken as `0x${string}`;
  const isNative = isNativeToken(buyToken);

  const { needsApproval, approve, isApproving, isApproved } = useTokenApproval(
    isNative ? undefined : buyToken,
    htlcAddress,
    buyAmount
  );

  const { createSwap, isPending: isCreating, isConfirming, isSuccess } = useCreateHTLCSwap(targetChainId);

  useEffect(() => {
    if (isSuccess) {
      setStep('done');
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  const handleLock = async () => {
    if (!address) return;
    setError(null);

    try {
      // Use the same hashlock from the creator's HTLC (synced from on-chain by useActiveSwaps)
      if (!meta.hashlock || meta.hashlock === '' || meta.hashlock === '0x') {
        setError('Hashlock not yet synced from creator\'s HTLC. Click Refresh and try again.');
        onUpdate();
        return;
      }
      const hashlock = meta.hashlock as `0x${string}`;

      // Step 1: Approve if needed
      if (needsApproval && !isApproved) {
        setStep('approving');
        await approve();
      }

      // Step 2: Create HTLC with 24h timelock (shorter than creator's 48h)
      setStep('locking');
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
      const swapId = generateSwapId(
        address,
        meta.creator as `0x${string}`,
        hashlock,
        timelock,
        targetChainId
      );

      // Save matcherHtlcSwapId before tx
      updateSwap(address, meta.orderId, { matcherHtlcSwapId: swapId }, meta.sourceChainId);

      await createSwap({
        swapId,
        participant: meta.creator as `0x${string}`,
        hashlock,
        timelock,
        token: buyToken,
        amount: buyAmount,
      });
    } catch (err: any) {
      console.error('Matcher lock failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to lock tokens');
      setStep('idle');
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      {step === 'done' || isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Tokens locked in HTLC successfully!
        </div>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={isApproving || isCreating || isConfirming}
          onClick={handleLock}
          disabled={isApproving || isCreating || isConfirming}
        >
          {isApproving
            ? 'Approving...'
            : isCreating || isConfirming
            ? 'Locking Tokens...'
            : needsApproval
            ? 'Approve & Lock Tokens'
            : 'Lock Tokens in HTLC'}
        </Button>
      )}
    </div>
  );
}

/**
 * Creator withdraws from matcher's HTLC (reveals secret)
 */
function CreatorWithdrawAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);

  const targetChainId = meta.targetChainId;
  const { withdraw, isPending, isConfirming, isSuccess } = useWithdrawHTLC(targetChainId);

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  const handleWithdraw = async () => {
    const secret = meta.secret || recoveredSecret;
    if (!address || !secret || !meta.matcherHtlcSwapId) return;
    setError(null);

    try {
      await withdraw(
        meta.matcherHtlcSwapId as `0x${string}`,
        secret as `0x${string}`
      );
    } catch (err: any) {
      console.error('Creator withdraw failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to withdraw');
    }
  };

  // Try to recover secret from strategy if not in swap meta
  const [recoveredSecret, setRecoveredSecret] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!meta.secret && address && !recoveredSecret && !isRecovering) {
      setIsRecovering(true);
      const strategy = getSecretStrategy(useSettingsStore.getState().secretStorage);
      const swapKey = buildSwapKey(address, meta.orderId, meta.sourceChainId);
      strategy.getSecret(swapKey).then((s) => {
        if (s) setRecoveredSecret(s);
        setIsRecovering(false);
      }).catch(() => setIsRecovering(false));
    }
  }, [meta.secret, address, meta.orderId, meta.sourceChainId, recoveredSecret, isRecovering]);

  const effectiveSecret = meta.secret || recoveredSecret;

  if (isRecovering) {
    return <WaitingMessage text="Looking up saved secret..." />;
  }

  if (!effectiveSecret) {
    return (
      <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">
        Secret not found. Check your secret storage settings in Profile.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      {isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Withdrawal successful! Secret revealed on-chain.
        </div>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={isPending || isConfirming}
          onClick={handleWithdraw}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? 'Withdrawing...' : 'Withdraw & Reveal Secret'}
        </Button>
      )}
    </div>
  );
}

/**
 * Matcher reads secret from event and withdraws from creator's HTLC
 */
function MatcherWithdrawAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);

  const sourceChainId = meta.sourceChainId;
  const targetChainId = meta.targetChainId;

  // Read secret from SwapWithdrawn event on the target chain
  // (creator withdrew from matcher's HTLC on target chain, that's where the secret is revealed)
  const { secret: revealedSecret, isLoading: isSearching } = useSwapSecretFromEvent(
    targetChainId,
    meta.matcherHtlcSwapId as `0x${string}` | undefined,
    true
  );

  const { withdraw, isPending, isConfirming, isSuccess } = useWithdrawHTLC(sourceChainId);

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  const handleWithdraw = async () => {
    if (!address || !revealedSecret || !meta.creatorHtlcSwapId) return;
    setError(null);

    try {
      await withdraw(
        meta.creatorHtlcSwapId as `0x${string}`,
        revealedSecret
      );
    } catch (err: any) {
      console.error('Matcher withdraw failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to withdraw');
    }
  };

  if (isSearching && !revealedSecret) {
    return <WaitingMessage text="Searching for revealed secret on-chain..." />;
  }

  if (!revealedSecret) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-yellow-400">Secret not yet found on-chain. It will appear after the creator withdraws.</p>
        <p className="text-xs text-gray-500">Auto-refreshing every 10 seconds...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-2 rounded bg-blue-500/10 text-blue-400 text-xs">
        Secret found: {revealedSecret.slice(0, 10)}...{revealedSecret.slice(-8)}
      </div>
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      {isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Withdrawal successful! Swap complete.
        </div>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={isPending || isConfirming}
          onClick={handleWithdraw}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? 'Withdrawing...' : 'Withdraw Tokens'}
        </Button>
      )}
    </div>
  );
}

/**
 * Refund action for expired HTLCs
 */
function RefundAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);

  // Determine which HTLC to refund
  const refundChain = meta.role === 'creator' ? meta.sourceChainId : meta.targetChainId;
  const swapIdToRefund = meta.role === 'creator' ? meta.creatorHtlcSwapId : meta.matcherHtlcSwapId;

  const { refund, isPending, isConfirming, isSuccess } = useRefundHTLC(refundChain);

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  const handleRefund = async () => {
    if (!swapIdToRefund) return;
    setError(null);

    try {
      await refund(swapIdToRefund as `0x${string}`);
    } catch (err: any) {
      console.error('Refund failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to refund');
    }
  };

  if (!swapIdToRefund) {
    return (
      <div className="text-sm text-gray-400">No HTLC to refund.</div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      {isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Refund successful! Tokens returned.
        </div>
      ) : (
        <Button
          size="sm"
          variant="danger"
          loading={isPending || isConfirming}
          onClick={handleRefund}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? 'Refunding...' : 'Refund Tokens'}
        </Button>
      )}
    </div>
  );
}

/**
 * Complete order on CCOB after both sides have withdrawn
 */
function CompleteAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);

  const { completeOrder, isPending, isConfirming, isSuccess } = useCompleteOrder(meta.sourceChainId);

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  // If CCOB order is already completed, just show success
  if (swap.orderStatus === 'Completed') {
    return (
      <Badge variant="success">Swap Completed</Badge>
    );
  }

  const handleComplete = async () => {
    setError(null);
    try {
      await completeOrder(BigInt(meta.orderId));
    } catch (err: any) {
      console.error('Complete order failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to complete order');
    }
  };

  return (
    <div className="space-y-3">
      <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
        Both sides have withdrawn. You can finalize the order on-chain.
      </div>
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      <Button
        size="sm"
        variant="primary"
        loading={isPending || isConfirming}
        onClick={handleComplete}
        disabled={isPending || isConfirming}
      >
        {isPending || isConfirming ? 'Completing...' : 'Complete Order'}
      </Button>
    </div>
  );
}
