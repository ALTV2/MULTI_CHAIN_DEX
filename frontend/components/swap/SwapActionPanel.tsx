'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain, useWriteContract } from 'wagmi';
import { useTxReceipt } from '@/hooks/useTxReceipt';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCreateHTLCSwap, useWithdrawHTLC, useRefundHTLC, generateSecret, generateHashlock, generateSwapId } from '@/hooks/useHTLC';
import { generateSwapId as generateSwapIdCrossChain } from '@/lib/utils/crossChainCrypto';
import { useCreateSuiHTLC, useWithdrawSuiHTLC, useRefundSuiHTLC, useSuiSecretWatcher, useSuiSecretWatcherByObjectId } from '@/hooks/useSuiHTLC';
import { useCancelSuiOrder } from '@/hooks/useSuiOrders';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useCompleteOrder } from '@/hooks/useCompleteOrder';
import { useUnifiedSecretWatcher } from '@/hooks/useUnifiedSecretWatcher';
import { useReactivateCrossChainOrder } from '@/hooks/useCrossChainOrders';
import { updateSwap, saveSwap } from '@/lib/utils/swapStorage';
import { getRequiredChain } from '@/lib/utils/swapPhase';
import { getContractAddress, chainConfig, SupportedChainId, getExplorerTxUrl } from '@/lib/contracts/addresses';
import { isNativeToken, evmPlaceholderToSuiToken } from '@/lib/constants/tokens';
import { useMemo } from 'react';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import type { ActiveSwap } from '@/types/swap';
import type { DetectedHTLC } from '@/hooks/useDetectCrossChainHTLC';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { toast } from 'sonner';
import { getPublicClient } from '@/lib/utils/rpcClient';

/**
 * Validate that a secret matches the expected hashlock before sending an on-chain transaction.
 * Returns an error message if invalid, or null if valid.
 */
function validateSecretAgainstHashlock(secret: string, hashlock: string | undefined): string | null {
  if (!hashlock || hashlock === '' || hashlock === '0x' || hashlock === '0x' + '0'.repeat(64)) return null;
  try {
    const computed = generateHashlock(secret as `0x${string}`);
    if (computed.toLowerCase() !== hashlock.toLowerCase()) {
      return `Secret does not match the hashlock. Expected: ${hashlock.slice(0, 10)}…, got: ${computed.slice(0, 10)}…`;
    }
  } catch {
    return 'Invalid secret format. Must be a 0x-prefixed 32-byte hex string.';
  }
  return null;
}

interface SwapActionPanelProps {
  swap: ActiveSwap;
  onUpdate: () => void;
  detectedHTLC?: DetectedHTLC | null;
}

export function SwapActionPanel({ swap, onUpdate, detectedHTLC }: SwapActionPanelProps) {
  const { address } = useAccount();
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
  // For EVM chains, check evmChainId matches
  // For SUI chain, check if SUI wallet is connected
  let needsChainSwitch = false;
  if (requiredChain !== null) {
    if (typeof requiredChain === 'number') {
      // EVM chain required
      needsChainSwitch = evmChainId !== requiredChain;
    } else if (typeof requiredChain === 'string' && requiredChain.includes('sui')) {
      // SUI chain required - check if SUI wallet is connected
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

    // For SUI chain, show a message to connect SUI wallet (can't switch programmatically)
    if (typeof requiredChain === 'string' && requiredChain.includes('sui')) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-yellow-400">
            Connect a SUI wallet to continue
          </p>
        </div>
      );
    }

    // For EVM chains, show switch button
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

function OrderCreatedAction({ swap, onUpdate, detectedHTLC }: { swap: ActiveSwap; onUpdate?: () => void; detectedHTLC?: DetectedHTLC | null }) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const isSameChain = swap.meta.sourceChainId === swap.meta.targetChainId;
  const evmChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);
  const [cancelTxHash, setCancelTxHash] = useState<`0x${string}` | undefined>();

  // EVM cancel logic
  const { writeContractAsync } = useWriteContract();

  // SUI cancel logic
  const { cancelOrder: cancelSuiOrder, isPending: isCancellingSui } = useCancelSuiOrder();

  // Wait for cancellation transaction
  const { isLoading: isConfirming, isSuccess } = useTxReceipt(cancelTxHash);

  const isCancelling = !!cancelTxHash && !isSuccess;

  // Check if user needs to switch chain to cancel the order
  const orderChainId = swap.meta.sourceChainId;
  let needsChainSwitch = false;

  if (swap.meta.role === 'creator') {
    if (typeof orderChainId === 'number') {
      // EVM chain - check if on correct EVM chain
      needsChainSwitch = evmChainId !== orderChainId;
    } else if (typeof orderChainId === 'string' && orderChainId.includes('sui')) {
      // SUI chain - check if SUI wallet is connected
      needsChainSwitch = !suiAccount;
    }
  }

  useEffect(() => {
    if (isSuccess && cancelTxHash && onUpdate) {
      toast.success('Order cancelled successfully!');
      setCancelTxHash(undefined);
      onUpdate();
    }
  }, [isSuccess, cancelTxHash, onUpdate]);

  const handleSwitchChain = async () => {
    if (typeof orderChainId === 'number') {
      await switchChainAsync({ chainId: orderChainId });
    }
  };

  const handleCancel = async () => {
    setError(null);

    try {
      // For SUI orders, use SUI cancellation logic
      if (typeof orderChainId === 'string' && orderChainId.includes('sui')) {
        if (!suiAccount) {
          const msg = 'Please connect a SUI wallet to cancel this order';
          setError(msg);
          toast.error(msg);
          return;
        }

        const numericOrderId = swap.meta.orderId.replace('sui-', '');
        await cancelSuiOrder(numericOrderId);
        toast.success('SUI order cancelled successfully!');

        if (onUpdate) {
          onUpdate();
        }
        return;
      }

      // Get the correct contract address based on order type (EVM only)
      const contractAddress = (isSameChain
        ? getContractAddress(orderChainId, 'orderBook')
        : getContractAddress(orderChainId, 'crossChainOrderBook')) as `0x${string}`;

      const abi = isSameChain ? orderBookABI : CROSS_CHAIN_ORDER_BOOK_ABI;

      // Check order status before cancellation
      const client = getPublicClient(orderChainId as number);
      const orderData = await client.readContract({
        address: contractAddress,
        abi,
        functionName: 'getOrder',
        args: [BigInt(swap.meta.orderId)],
      }) as any;

      const statusMap = ['Active', 'Matched', 'Completed', 'Cancelled', 'Expired'];
      const currentStatus = statusMap[orderData.status] || `Unknown(${orderData.status})`;

      if (orderData.status !== 0) { // 0 = Active
        const msg = `Cannot cancel: Order is ${currentStatus}`;
        toast.error(msg);
        setError(msg);
        return;
      }

      if (orderData.creator?.toLowerCase() !== address?.toLowerCase()) {
        const msg = 'You are not the creator of this order';
        toast.error(msg);
        setError(msg);
        return;
      }

      // Polygon Amoy requires higher gas prices
      const isPolygon = orderChainId === 80002;
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
        args: [BigInt(swap.meta.orderId)],
        ...gasConfig,
      });

      const explorerUrl = getExplorerTxUrl(orderChainId, hash);

      setCancelTxHash(hash);

      // Show toast with link
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
      console.error('Cancel failed:', err);
      const errorMsg = err?.shortMessage || err?.message || 'Failed to cancel order';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-3">
      {/* If HTLC detected on target chain, show action to create counter-HTLC */}
      {detectedHTLC && swap.meta.role === 'creator' ? (
        <CreateCounterHTLCAction swap={swap} detectedHTLC={detectedHTLC} onUpdate={onUpdate} />
      ) : (
        <>
          <div className="text-sm text-gray-400">
            {swap.meta.role === 'creator'
              ? 'Your order is active and visible to counterparties. Waiting for a match...'
              : 'This order is available for matching.'}
          </div>

          {/* Show cancel button for orders created by this user */}
          {swap.meta.role === 'creator' && (
        <>
          {needsChainSwitch ? (
            <div className="space-y-2">
              {typeof orderChainId === 'string' && orderChainId.includes('sui') ? (
                <p className="text-sm text-yellow-400">
                  Connect a SUI wallet to cancel this order
                </p>
              ) : (
                <>
                  <p className="text-sm text-yellow-400">
                    Switch to {chainConfig[orderChainId as SupportedChainId]?.shortName || 'the order chain'} to cancel this order
                  </p>
                  <Button onClick={handleSwitchChain} size="sm" variant="primary">
                    Switch to {chainConfig[orderChainId as SupportedChainId]?.shortName}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
              )}
              {isSuccess ? (
                <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
                  Order cancelled successfully!
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  loading={isCancelling || isConfirming || isCancellingSui}
                  onClick={handleCancel}
                  disabled={isCancelling || isConfirming || isCancellingSui}
                >
                  {(isCancelling || isConfirming || isCancellingSui) ? 'Cancelling...' : 'Cancel Order'}
                </Button>
              )}
            </>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}

/**
 * Creator creates counter-HTLC on source chain after matcher's HTLC detected on target chain.
 * Handles both:
 *   SUI→EVM: creator creates SUI HTLC after matcher's EVM HTLC detected
 *   EVM→SUI: creator withdraws from detected SUI HTLC (detectedHTLC.htlcObjectId)
 */
function CreateCounterHTLCAction({
  swap,
  detectedHTLC,
  onUpdate,
}: {
  swap: ActiveSwap;
  detectedHTLC: NonNullable<SwapActionPanelProps['detectedHTLC']>;
  onUpdate?: () => void;
}) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const { meta } = swap;
  const [isPending, setIsPending] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuiSource = typeof meta.sourceChainId === 'string';
  const isSuiTarget = typeof meta.targetChainId === 'string';

  // SUI→EVM: create SUI counter-HTLC
  const suiHTLC = useCreateSuiHTLC();

  // EVM→SUI: creator withdraws from matcher's SUI HTLC using their secret
  const [inputSecret, setInputSecret] = useState('');
  const suiWithdraw = useWithdrawSuiHTLC();
  const isValidSecret = /^0x[a-fA-F0-9]{64}$/.test(inputSecret);

  const sourceChainName = chainConfig[meta.sourceChainId as SupportedChainId]?.shortName || 'source chain';
  const targetChainName = chainConfig[meta.targetChainId as SupportedChainId]?.shortName || 'target chain';

  const handleCreateSuiCounterHTLC = async () => {
    if (!suiAccount || !address) return;
    setIsPending(true);
    setError(null);
    try {
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600); // 24h
      // participant = matcher's SUI address (stored as targetAddress by MatchOrderModal)
      const matcherSuiAddress = meta.targetAddress || '';
      if (!matcherSuiAddress) throw new Error('Matcher SUI address not found in swap metadata');

      const { digest, htlcObjectId } = await suiHTLC.createSwap({
        swapId: detectedHTLC.swapId,
        participant: matcherSuiAddress,
        hashlock: detectedHTLC.hashlock,
        timelock,
        tokenType: meta.sellToken,
        amount: BigInt(meta.sellAmount),
      });

      // Save SUI HTLC object ID for later withdrawal by matcher.
      // Also save the shared swapId as matcherHtlcSwapId so swapPhase.ts can infer
      // matcherHtlcStatus = Active → phase advances to matcher_htlc_created.
      updateSwap(address, meta.orderId, {
        creatorHtlcSwapId: detectedHTLC.swapId,   // Shared swapId (same for both HTLCs)
        matcherHtlcSwapId: detectedHTLC.swapId,   // EVM HTLC swapId used in SUI source withdraw
        creatorHtlcObjectId: htlcObjectId || undefined,
        hashlock: detectedHTLC.hashlock,
      }, meta.sourceChainId);

      toast.success('Counter-HTLC created on SUI! Waiting for matcher to withdraw and reveal secret.');
      setIsDone(true);
      onUpdate?.();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create counter-HTLC';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  };

  const handleWithdrawSuiHTLC = async () => {
    if (!suiAccount || !detectedHTLC.htlcObjectId || !isValidSecret) return;
    setIsPending(true);
    setError(null);
    try {
      await suiWithdraw.withdraw({
        swapObjectId: detectedHTLC.htlcObjectId,
        secret: inputSecret as `0x${string}`,
        tokenType: meta.buyToken,
      });
      toast.success('Withdrawn from SUI HTLC successfully!');
      setIsDone(true);
      onUpdate?.();
    } catch (err: any) {
      const msg = err?.message || 'Failed to withdraw from SUI HTLC';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  };

  if (isDone) {
    return <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">Done! Awaiting next step...</div>;
  }

  // SUI→EVM: create counter-HTLC on SUI
  if (isSuiSource && !isSuiTarget) {
    const bothConnected = !!suiAccount && !!address;
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-300">
          ✅ Matcher locked {chainConfig[meta.targetChainId as SupportedChainId]?.shortName || 'EVM'} tokens.
          Create your counter-HTLC on {sourceChainName} to continue.
        </div>
        {!bothConnected && (
          <p className="text-xs text-yellow-400">Both MetaMask and Slush wallets must be connected.</p>
        )}
        {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}
        <Button
          size="sm"
          variant="primary"
          loading={isPending || suiHTLC.isPending}
          disabled={!bothConnected || isPending || suiHTLC.isPending}
          onClick={handleCreateSuiCounterHTLC}
        >
          {isPending ? 'Creating...' : `Lock tokens on ${sourceChainName}`}
        </Button>
      </div>
    );
  }

  // EVM→SUI: withdraw from matcher's SUI HTLC using creator's secret
  if (!isSuiSource && isSuiTarget && detectedHTLC.htlcObjectId) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-300">
          ✅ Matcher locked {targetChainName} tokens. Enter your secret to claim them.
        </div>
        <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
          <p className="text-xs font-semibold text-blue-300">Enter your secret to claim tokens</p>
          <input
            type="text"
            value={inputSecret}
            onChange={(e) => setInputSecret(e.target.value.trim())}
            placeholder="0x..."
            className={`w-full px-3 py-2 rounded-lg border text-xs font-mono bg-dark-card text-gray-100 focus:outline-none ${
              inputSecret ? (isValidSecret ? 'border-green-500/60' : 'border-red-500/60') : 'border-gray-600'
            }`}
          />
        </div>
        {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}
        <Button
          size="sm"
          variant="primary"
          loading={isPending || suiWithdraw.isPending}
          disabled={!isValidSecret || !suiAccount || isPending || suiWithdraw.isPending}
          onClick={handleWithdrawSuiHTLC}
        >
          {isPending ? 'Withdrawing...' : `Claim tokens on ${targetChainName}`}
        </Button>
      </div>
    );
  }

  return null;
}

/**
 * Creator locks tokens in HTLC on source chain (48h timelock)
 */
function CreatorLockAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta, phase } = swap;
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approving' | 'locking' | 'done'>('idle');
  const [secretSaved, setSecretSaved] = useState(false);
  const [reactivateTxHash, setReactivateTxHash] = useState<`0x${string}` | undefined>();

  // Generate secret once for this component instance — persisted to localStorage after successful lock
  const [sessionSecret] = useState<`0x${string}`>(() => generateSecret());
  const sessionHashlock = useMemo(() => generateHashlock(sessionSecret), [sessionSecret]);

  // CreatorLockAction is only rendered for EVM source chains
  const sourceChainId = meta.sourceChainId as number;
  const htlcAddress = getContractAddress(sourceChainId, 'htlc') as `0x${string}`;
  const sellAmount = BigInt(meta.sellAmount);
  const sellToken = meta.sellToken as `0x${string}`;
  const isNative = isNativeToken(sourceChainId, sellToken);

  const { needsApproval, approve, isApproving, isApproved } = useTokenApproval(
    isNative ? undefined : sellToken,
    htlcAddress,
    sellAmount
  );

  const { createSwap, isPending: isCreating, isConfirming, isSuccess } = useCreateHTLCSwap(sourceChainId);
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isReactivateConfirming, isSuccess: isReactivateSuccess } = useTxReceipt(reactivateTxHash);

  const isReactivating = !!reactivateTxHash && !isReactivateSuccess;

  useEffect(() => {
    if (isSuccess) {
      setStep('done');
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  useEffect(() => {
    if (isReactivateSuccess && reactivateTxHash && onUpdate) {
      toast.success('Match cancelled! Your order is back in the order book.');
      setReactivateTxHash(undefined);
      onUpdate();
    }
  }, [isReactivateSuccess, reactivateTxHash, onUpdate]);

  const handleCancelMatch = async () => {
    setError(null);

    try {
      const contractAddress = getContractAddress(sourceChainId, 'crossChainOrderBook') as `0x${string}`;
      const client = getPublicClient(sourceChainId);
      const orderData = await client.readContract({
        address: contractAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'getOrder',
        args: [BigInt(meta.orderId)],
      }) as any;

      const statusMap = ['Active', 'Matched', 'Completed', 'Cancelled', 'Expired'];
      const currentStatus = statusMap[orderData.status] || `Unknown(${orderData.status})`;

      if (orderData.status !== 1) {
        const msg = `Cannot reactivate: Order is ${currentStatus}, not Matched`;
        toast.error(msg);
        setError(msg);
        return;
      }

      if (orderData.creator?.toLowerCase() !== address?.toLowerCase()) {
        const msg = 'You are not the creator of this order';
        toast.error(msg);
        setError(msg);
        return;
      }

      const expiresAt = Number(orderData.expiresAt);
      const now = Math.floor(Date.now() / 1000);
      if (now >= expiresAt) {
        const msg = 'Order has expired and cannot be reactivated';
        toast.error(msg);
        setError(msg);
        return;
      }

      const isPolygon = sourceChainId === 80002;
      const gasConfig = isPolygon
        ? { gas: 300000n, maxFeePerGas: 50000000000n, maxPriorityFeePerGas: 50000000000n }
        : { gas: 300000n };

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'reactivateOrder',
        args: [BigInt(meta.orderId)],
        ...gasConfig,
      });

      setReactivateTxHash(hash);
      toast.info(
        <div>
          Transaction submitted!<br />
          <a href={getExplorerTxUrl(sourceChainId, hash)} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 underline text-xs mt-1 inline-block">View on explorer →</a>
        </div>,
        { duration: 10000 }
      );
    } catch (err: any) {
      console.error('Cancel match failed:', err);
      const errorMsg = err?.shortMessage || err?.message || 'Failed to cancel match';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleLock = async () => {
    if (!address || !secretSaved) return;

    if (!meta.matcher) {
      setError('Matcher address not yet synced. Click Refresh and try again.');
      onUpdate();
      return;
    }

    setError(null);

    try {
      // Save hashlock + secret so CreatorWithdrawAction can auto-fill it
      updateSwap(address, meta.orderId, { hashlock: sessionHashlock, secret: sessionSecret }, meta.sourceChainId);

      if (needsApproval && !isApproved) {
        setStep('approving');
        await approve();
      }

      setStep('locking');
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 48 * 3600);
      const swapId = generateSwapId(
        address,
        meta.matcher as `0x${string}`,
        sessionHashlock,
        timelock,
        sourceChainId
      );

      updateSwap(address, meta.orderId, { creatorHtlcSwapId: swapId }, meta.sourceChainId);

      await createSwap({
        swapId,
        participant: meta.matcher as `0x${string}`,
        hashlock: sessionHashlock,
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
        <Button size="sm" variant="secondary" onClick={onUpdate}>Refresh</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {phase === 'order_matched' && (
        <div className="text-xs text-gray-500">
          Matched by: <span className="font-mono">{meta.matcher.slice(0, 6)}...{meta.matcher.slice(-4)}</span>
        </div>
      )}

      {/* Secret — shown once, never stored */}
      {step !== 'done' && !isSuccess && (
        <div className="p-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 space-y-2">
          <p className="text-xs font-semibold text-yellow-400">⚠️ Save your secret as backup — it is stored locally but may be lost if you clear browser data!</p>
          <p className="text-xs text-gray-400">The secret will be auto-filled when claiming, but keep a copy just in case.</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono break-all text-gray-200 flex-1 select-all">{sessionSecret}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(sessionSecret);
                toast.success('Secret copied!');
              }}
            >
              Copy
            </Button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={secretSaved}
              onChange={(e) => setSecretSaved(e.target.checked)}
              className="w-4 h-4 accent-yellow-400"
            />
            <span className="text-xs text-gray-300">I have saved my secret in a safe place</span>
          </label>
        </div>
      )}

      {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}

      {step === 'done' || isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Tokens locked in HTLC successfully!
        </div>
      ) : (
        <div className="flex gap-2">
          {phase === 'order_matched' && (
            <Button
              size="sm"
              variant="danger"
              loading={isReactivating || isReactivateConfirming}
              onClick={handleCancelMatch}
              disabled={isApproving || isCreating || isConfirming || isReactivating || isReactivateConfirming}
            >
              {isReactivating || isReactivateConfirming ? 'Cancelling Match...' : 'Cancel Match'}
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            loading={isApproving || isCreating || isConfirming}
            onClick={handleLock}
            disabled={!secretSaved || isApproving || isCreating || isConfirming || isReactivating || isReactivateConfirming}
          >
            {isApproving ? 'Approving...'
              : isCreating || isConfirming ? 'Locking Tokens...'
              : needsApproval ? 'Approve & Lock Tokens'
              : 'Lock Tokens in HTLC'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Matcher locks tokens in HTLC on target chain (24h timelock).
 * Handles EVM target (EVM→EVM) and SUI target (EVM→SUI).
 */
function MatcherLockAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approving' | 'locking' | 'done'>('idle');

  const isSuiTarget = typeof meta.targetChainId === 'string';

  // EVM target
  const evmTargetChainId = isSuiTarget ? 11155111 : meta.targetChainId as number;
  const htlcAddress = isSuiTarget ? '' : getContractAddress(evmTargetChainId, 'htlc') as `0x${string}`;
  const buyAmount = BigInt(meta.buyAmount);
  const buyToken = meta.buyToken as `0x${string}`;
  const isNative = !isSuiTarget && isNativeToken(evmTargetChainId, buyToken);

  const { needsApproval, approve, isApproving, isApproved } = useTokenApproval(
    (!isSuiTarget && !isNative) ? buyToken : undefined,
    (htlcAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    buyAmount
  );

  const { createSwap: createEvmSwap, isPending: isEvmCreating, isConfirming, isSuccess: isEvmSuccess } = useCreateHTLCSwap(evmTargetChainId);
  const suiHTLC = useCreateSuiHTLC();

  useEffect(() => {
    if (isEvmSuccess) {
      setStep('done');
      onUpdate();
    }
  }, [isEvmSuccess, onUpdate]);

  const handleLock = async () => {
    if (!address) return;
    setError(null);

    try {
      if (!meta.hashlock || meta.hashlock === '' || meta.hashlock === '0x') {
        setError('Hashlock not yet synced from creator\'s HTLC. Click Refresh and try again.');
        onUpdate();
        return;
      }
      const hashlock = meta.hashlock as `0x${string}`;
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);

      if (isSuiTarget) {
        // EVM→SUI: create SUI HTLC — lock SUI tokens for the creator
        if (!suiAccount) {
          setError('Connect Slush (SUI) wallet to lock tokens on SUI');
          return;
        }
        // For EVM→SUI: targetAddress/creatorSuiAddress may be truncated 20-byte EVM format.
        // SUI expects 32-byte (64 hex chars). Zero-pad on the left if needed.
        let creatorSuiAddress = meta.creatorSuiAddress || meta.targetAddress || '';
        if (!creatorSuiAddress) {
          setError('Creator SUI address not found in swap metadata');
          return;
        }
        // Ensure SUI address is 32 bytes (0x + 64 hex)
        const rawHex = creatorSuiAddress.replace('0x', '');
        if (rawHex.length < 64) {
          creatorSuiAddress = `0x${rawHex.padStart(64, '0')}`;
        }

        const swapId = generateSwapIdCrossChain(
          address as `0x${string}`,
          meta.creator as `0x${string}`,
          hashlock,
          timelock,
          meta.targetChainId
        );

        // For EVM→SUI: meta.buyToken is an EVM placeholder — resolve to real SUI token type
        const suiTokenType = evmPlaceholderToSuiToken(meta.buyToken) || meta.buyToken;

        setStep('locking');
        const { digest, htlcObjectId } = await suiHTLC.createSwap({
          swapId,
          participant: creatorSuiAddress,
          hashlock,
          timelock,
          tokenType: suiTokenType,
          amount: buyAmount,
        });

        updateSwap(address, meta.orderId, {
          matcherHtlcSwapId: swapId,
          matcherHtlcObjectId: htlcObjectId || undefined,
        }, meta.sourceChainId);

        toast.success('SUI HTLC created! Waiting for creator to withdraw and reveal secret.');
        setStep('done');
        onUpdate();
      } else {
        // EVM→EVM: create EVM HTLC
        if (needsApproval && !isApproved) {
          setStep('approving');
          await approve();
        }

        setStep('locking');
        const swapId = generateSwapId(
          address,
          meta.creator as `0x${string}`,
          hashlock,
          timelock,
          evmTargetChainId
        );

        updateSwap(address, meta.orderId, { matcherHtlcSwapId: swapId }, meta.sourceChainId);

        await createEvmSwap({
          swapId,
          participant: meta.creator as `0x${string}`,
          hashlock,
          timelock,
          token: buyToken,
          amount: buyAmount,
        });
      }
    } catch (err: any) {
      console.error('MatcherLockAction failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to lock tokens');
      setStep('idle');
    }
  };

  const isCreating = isSuiTarget ? suiHTLC.isPending : isEvmCreating;
  const isLoading = isApproving || isCreating || isConfirming;

  return (
    <div className="space-y-3">
      {isSuiTarget && !suiAccount && (
        <p className="text-xs text-yellow-400">Connect Slush (SUI) wallet to lock tokens on SUI.</p>
      )}
      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}
      {step === 'done' || isEvmSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Tokens locked in HTLC successfully!
        </div>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={isLoading}
          onClick={handleLock}
          disabled={isLoading || (isSuiTarget && !suiAccount)}
        >
          {isApproving ? 'Approving...'
            : isCreating || isConfirming ? 'Locking Tokens...'
            : !isSuiTarget && needsApproval ? 'Approve & Lock Tokens'
            : 'Lock Tokens in HTLC'}
        </Button>
      )}
    </div>
  );
}

/**
 * Creator withdraws from matcher's HTLC (reveals secret).
 * Handles EVM target (EVM→EVM / SUI→EVM) and SUI target (EVM→SUI).
 * Secret is never stored — user must enter it manually.
 */
function CreatorWithdrawAction({ swap, onUpdate, detectedHTLC }: { swap: ActiveSwap; onUpdate: () => void; detectedHTLC?: DetectedHTLC | null }) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [inputSecret, setInputSecret] = useState(meta.secret || '');
  const [isSuiDone, setIsSuiDone] = useState(false);

  const isSuiTarget = typeof meta.targetChainId === 'string';

  // EVM target: withdraw from EVM HTLC
  const evmTargetChainId = isSuiTarget ? 11155111 : meta.targetChainId as number;
  const evmWithdraw = useWithdrawHTLC(evmTargetChainId);

  // SUI target: withdraw from SUI HTLC using matcherHtlcObjectId
  const suiWithdraw = useWithdrawSuiHTLC();

  useEffect(() => {
    if (evmWithdraw.isSuccess) onUpdate();
  }, [evmWithdraw.isSuccess, onUpdate]);

  const isValidSecret = /^0x[a-fA-F0-9]{64}$/.test(inputSecret);

  const handleWithdraw = async () => {
    setError(null);
    const hashlockErr = validateSecretAgainstHashlock(inputSecret, meta.hashlock);
    if (hashlockErr) { setError(hashlockErr); return; }
    try {
      if (isSuiTarget) {
        if (!suiAccount) { setError('Connect Slush (SUI) wallet to withdraw'); return; }
        // Prefer stored objectId; fall back to live-detected HTLC object ID
        const objectId = meta.matcherHtlcObjectId || detectedHTLC?.htlcObjectId;
        if (!objectId) { setError('Matcher SUI HTLC object ID not found. Wait for detection or refresh.'); return; }
        await suiWithdraw.withdraw({
          swapObjectId: objectId,
          secret: inputSecret as `0x${string}`,
          tokenType: meta.buyToken,
        });
        toast.success('Withdrawn from SUI HTLC! Secret revealed on SUI.');
        // Flag that matcher's SUI HTLC was withdrawn so swapPhase advances to secret_revealed
        if (address) updateSwap(address, meta.orderId, { matcherHtlcWithdrawn: true }, meta.sourceChainId);
        setIsSuiDone(true);
        onUpdate();
      } else {
        if (!address || !meta.matcherHtlcSwapId) return;
        await evmWithdraw.withdraw(
          meta.matcherHtlcSwapId as `0x${string}`,
          inputSecret as `0x${string}`
        );
        // Flag that matcher's EVM HTLC was withdrawn (for SUI source chains where on-chain status isn't fetched)
        if (address) updateSwap(address, meta.orderId, { matcherHtlcWithdrawn: true }, meta.sourceChainId);
      }
    } catch (err: any) {
      console.error('CreatorWithdrawAction failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to withdraw');
    }
  };

  const isPending = isSuiTarget ? suiWithdraw.isPending : evmWithdraw.isPending;
  const isConfirming = isSuiTarget ? false : evmWithdraw.isConfirming;
  const isSuccess = isSuiTarget ? isSuiDone : evmWithdraw.isSuccess;

  return (
    <div className="space-y-3">
      {isSuiTarget && !meta.matcherHtlcObjectId && !detectedHTLC?.htlcObjectId && (
        <div className="p-2 rounded bg-yellow-500/10 text-yellow-400 text-xs">
          Waiting to detect matcher&apos;s SUI HTLC object ID... (auto-checking every 15s)
        </div>
      )}
      {isSuiTarget && !suiAccount && (
        <p className="text-xs text-yellow-400">Connect Slush (SUI) wallet to withdraw.</p>
      )}
      <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
        <p className="text-xs font-semibold text-blue-300">Enter your secret to claim tokens</p>
        <p className="text-xs text-gray-400">This is the secret you saved when locking tokens in HTLC.</p>
        <input
          type="text"
          value={inputSecret}
          onChange={(e) => setInputSecret(e.target.value.trim())}
          placeholder="0x..."
          className={`w-full px-3 py-2 rounded-lg border text-xs font-mono bg-dark-card text-gray-100 focus:outline-none focus:ring-1 ${
            inputSecret
              ? isValidSecret ? 'border-green-500/60 focus:ring-green-500' : 'border-red-500/60 focus:ring-red-500'
              : 'border-gray-600 focus:ring-blue-500'
          }`}
        />
        {inputSecret && !isValidSecret && (
          <p className="text-xs text-red-400">Invalid format — must be 0x followed by 64 hex characters</p>
        )}
      </div>

      {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}

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
          disabled={!isValidSecret || isPending || isConfirming || (isSuiTarget && (!suiAccount || (!meta.matcherHtlcObjectId && !detectedHTLC?.htlcObjectId)))}
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
  // Works with both EVM and SUI chains
  const { secret: revealedSecret, isLoading: isSearching } = useUnifiedSecretWatcher(
    targetChainId,
    meta.matcherHtlcSwapId as `0x${string}` | undefined,
    true
  );

  // Use appropriate withdraw hook based on source chain type
  const isEvmSource = typeof sourceChainId === 'number';
  const evmWithdraw = useWithdrawHTLC(isEvmSource ? (sourceChainId as number) : 0);
  const suiWithdraw = useWithdrawSuiHTLC();
  const [isSuiWithdrawDone, setIsSuiWithdrawDone] = useState(false);

  const isPending = isEvmSource ? evmWithdraw.isPending : suiWithdraw.isPending;
  const isConfirming = isEvmSource ? evmWithdraw.isConfirming : false;
  const isSuccess = isEvmSource ? evmWithdraw.isSuccess : isSuiWithdrawDone;

  const withdraw = async (swapIdOrObjectId: string, secret: string) => {
    if (isEvmSource) {
      return evmWithdraw.withdraw(swapIdOrObjectId as `0x${string}`, secret as `0x${string}`);
    } else {
      // SUI source: withdraw using the Move object ID (not bytes32 swapId)
      const objectId = meta.creatorHtlcObjectId || meta.creatorHtlcSwapId;
      if (!objectId) throw new Error('Missing SUI HTLC object ID');
      await suiWithdraw.withdraw({
        swapObjectId: objectId,
        secret: secret as `0x${string}`,
        tokenType: meta.sellToken,
      });
      // Flag that creator's SUI HTLC was withdrawn → swapPhase.ts infers creatorHtlcStatus=Withdrawn
      // → Pattern 2 secret_revealed case triggers → creator can now claim from EVM HTLC
      if (address) updateSwap(address, meta.orderId, { creatorHtlcWithdrawn: true }, meta.sourceChainId);
      setIsSuiWithdrawDone(true);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  const handleWithdraw = async () => {
    if (!address || !revealedSecret || !meta.creatorHtlcSwapId) return;
    setError(null);
    const hashlockErr = validateSecretAgainstHashlock(revealedSecret, meta.hashlock);
    if (hashlockErr) { setError(hashlockErr); return; }

    try {
      await withdraw(
        meta.creatorHtlcSwapId as `0x${string}`,
        revealedSecret
      );

      // For SUI, manually trigger update since isSuccess won't be set
      if (!isEvmSource) {
        toast.success('Withdrawal successful on SUI!');
        onUpdate();
      }
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
 * SUI→EVM Pattern 2: Matcher withdraws from creator's SUI HTLC using their own secret.
 * Reveals the secret on SUI chain. Shown at matcher_htlc_created for matcher role.
 */
function SuiSourceMatcherWithdrawAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [isSuiDone, setIsSuiDone] = useState(false);
  const [manualSecret, setManualSecret] = useState('');

  const suiWithdraw = useWithdrawSuiHTLC();

  const effectiveSecret = meta.secret || (manualSecret.trim() || undefined);

  const handleWithdraw = async () => {
    setError(null);
    if (effectiveSecret) {
      const hashlockErr = validateSecretAgainstHashlock(effectiveSecret, meta.hashlock);
      if (hashlockErr) { setError(hashlockErr); return; }
    }
    try {
      if (!suiAccount) { setError('Connect Slush (SUI) wallet to withdraw'); return; }
      if (!effectiveSecret) { setError('Secret is required'); return; }
      const objectId = meta.creatorHtlcObjectId || meta.creatorHtlcSwapId;
      if (!objectId) { setError('Creator SUI HTLC object ID not found'); return; }

      await suiWithdraw.withdraw({
        swapObjectId: objectId,
        secret: effectiveSecret as `0x${string}`,
        tokenType: meta.sellToken,
      });

      // Flag that creator's SUI HTLC was withdrawn → swapPhase.ts Pattern 2 → secret_revealed
      if (address) updateSwap(address, meta.orderId, { creatorHtlcWithdrawn: true }, meta.sourceChainId);
      toast.success('Withdrawn from SUI HTLC! Secret revealed on SUI chain.');
      setIsSuiDone(true);
      onUpdate();
    } catch (err: any) {
      console.error('SuiSourceMatcherWithdrawAction failed:', err);
      setError(err?.message || 'Failed to withdraw from SUI HTLC');
    }
  };

  if (isSuiDone) {
    return (
      <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
        Withdrawn from SUI HTLC! Waiting for counterparty to claim EVM tokens.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-300">
        Both HTLCs are locked. Withdraw from the creator&apos;s SUI HTLC to receive your SUI tokens and reveal the secret.
      </div>
      {!suiAccount && (
        <p className="text-xs text-yellow-400">Connect Slush (SUI) wallet to withdraw.</p>
      )}
      {!meta.secret && (
        <div className="space-y-1">
          <p className="text-xs text-yellow-400">Secret not found in local storage. Enter it manually (0x-prefixed, 32 bytes):</p>
          <input
            type="text"
            placeholder="0x..."
            value={manualSecret}
            onChange={(e) => setManualSecret(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono"
          />
        </div>
      )}
      {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}
      <Button
        size="sm"
        variant="primary"
        loading={suiWithdraw.isPending}
        onClick={handleWithdraw}
        disabled={suiWithdraw.isPending || !suiAccount || !effectiveSecret}
      >
        {suiWithdraw.isPending ? 'Withdrawing...' : 'Withdraw SUI Tokens'}
      </Button>
    </div>
  );
}

/**
 * SUI→EVM Pattern 2: Creator watches SUI for secret revealed by matcher, then claims EVM HTLC.
 * Shown at secret_revealed for creator role when source is SUI.
 */
function SuiSourceCreatorClaimEvmAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [secretByObjectId, setSecretByObjectId] = useState<`0x${string}` | null>(null);

  // Primary: watch by swap_id (available from localStorage)
  const { secret: secretBySwapId, isLoading: isSearchingBySwapId } = useUnifiedSecretWatcher(
    meta.sourceChainId,
    meta.creatorHtlcSwapId as `0x${string}` | undefined,
    !!meta.creatorHtlcSwapId
  );

  // Fallback: watch by SUI object ID (available from on-chain enrichment after localStorage clear)
  const handleObjectIdSecret = useMemo(
    () => (s: `0x${string}`) => setSecretByObjectId(s),
    []
  );
  const { isWatching: isSearchingByObjectId } = useSuiSecretWatcherByObjectId(
    !meta.creatorHtlcSwapId ? meta.creatorHtlcObjectId : undefined,
    handleObjectIdSecret
  );

  const revealedSecret = secretBySwapId || secretByObjectId;
  const isSearching = meta.creatorHtlcSwapId ? isSearchingBySwapId : isSearchingByObjectId;

  // Withdraw from matcher's EVM HTLC on target chain
  const evmTargetChainId = meta.targetChainId as number;
  const evmWithdraw = useWithdrawHTLC(evmTargetChainId);

  useEffect(() => {
    if (evmWithdraw.isSuccess) {
      if (address) updateSwap(address, meta.orderId, { matcherHtlcWithdrawn: true }, meta.sourceChainId);
      onUpdate();
    }
  }, [evmWithdraw.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClaim = async () => {
    if (!address || !revealedSecret || !meta.matcherHtlcSwapId) return;
    setError(null);
    const hashlockErr = validateSecretAgainstHashlock(revealedSecret, meta.hashlock);
    if (hashlockErr) { setError(hashlockErr); return; }
    try {
      await evmWithdraw.withdraw(
        meta.matcherHtlcSwapId as `0x${string}`,
        revealedSecret as `0x${string}`
      );
    } catch (err: any) {
      console.error('SuiSourceCreatorClaimEvmAction failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to claim EVM tokens');
    }
  };

  if (isSearching && !revealedSecret) {
    return <WaitingMessage text="Watching SUI for revealed secret..." />;
  }

  if (!revealedSecret) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-yellow-400">Secret not yet revealed on SUI. Waiting for counterparty to withdraw...</p>
        <p className="text-xs text-gray-500">Auto-checking every 10 seconds...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-2 rounded bg-blue-500/10 text-blue-400 text-xs">
        Secret found: {revealedSecret.slice(0, 10)}...{revealedSecret.slice(-8)}
      </div>
      {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}
      {evmWithdraw.isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          EVM tokens claimed! Swap complete.
        </div>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={evmWithdraw.isPending || evmWithdraw.isConfirming}
          onClick={handleClaim}
          disabled={evmWithdraw.isPending || evmWithdraw.isConfirming}
        >
          {evmWithdraw.isPending || evmWithdraw.isConfirming ? 'Claiming...' : 'Claim EVM Tokens'}
        </Button>
      )}
    </div>
  );
}

/**
 * Refund action for expired HTLCs. Handles both EVM and SUI chains.
 */
function RefundAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);
  const [isSuiDone, setIsSuiDone] = useState(false);

  // Determine refund chain and HTLC to refund
  const refundChainId = meta.role === 'creator' ? meta.sourceChainId : meta.targetChainId;
  const isSuiRefund = typeof refundChainId === 'string';

  const swapIdToRefund = meta.role === 'creator' ? meta.creatorHtlcSwapId : meta.matcherHtlcSwapId;
  const objectIdToRefund = meta.role === 'creator' ? meta.creatorHtlcObjectId : meta.matcherHtlcObjectId;
  const tokenType = meta.role === 'creator' ? meta.sellToken : meta.buyToken;

  // EVM refund
  const evmRefund = useRefundHTLC(isSuiRefund ? 0 : refundChainId as number);
  const suiRefund = useRefundSuiHTLC();

  useEffect(() => {
    if (evmRefund.isSuccess) onUpdate();
  }, [evmRefund.isSuccess, onUpdate]);

  const handleRefund = async () => {
    setError(null);
    try {
      if (isSuiRefund) {
        if (!suiAccount) { setError('Connect Slush (SUI) wallet to refund'); return; }
        const objectId = objectIdToRefund || swapIdToRefund;
        if (!objectId) { setError('No SUI HTLC object ID found'); return; }
        await suiRefund.refund({ swapObjectId: objectId, tokenType });
        toast.success('SUI HTLC refunded!');
        setIsSuiDone(true);
        onUpdate();
      } else {
        if (!swapIdToRefund) { setError('No HTLC swap ID found'); return; }
        await evmRefund.refund(swapIdToRefund as `0x${string}`);
      }
    } catch (err: any) {
      console.error('Refund failed:', err);
      setError(err?.shortMessage || err?.message || 'Failed to refund');
    }
  };

  const isPending = isSuiRefund ? suiRefund.isPending : evmRefund.isPending;
  const isConfirming = isSuiRefund ? false : evmRefund.isConfirming;
  const isSuccess = isSuiRefund ? isSuiDone : evmRefund.isSuccess;

  if (!swapIdToRefund && !objectIdToRefund) {
    return <div className="text-sm text-gray-400">No HTLC to refund.</div>;
  }

  return (
    <div className="space-y-3">
      {isSuiRefund && !suiAccount && (
        <p className="text-xs text-yellow-400">Connect Slush (SUI) wallet to refund.</p>
      )}
      {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}
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
          disabled={isPending || isConfirming || (isSuiRefund && !suiAccount)}
        >
          {isPending || isConfirming ? 'Refunding...' : 'Refund Tokens'}
        </Button>
      )}
    </div>
  );
}

/**
 * SUI→EVM Pattern 2: Creator creates SUI counter-HTLC after matcher has locked EVM HTLC.
 * Shown at order_matched for creator role when source is SUI.
 * Reads hashlock from matcher's EVM HTLC, then creates a SUI HTLC with the same hashlock.
 */
function SuiSourceCreatorCounterHTLCAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const { meta } = swap;
  const [hashlock, setHashlock] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const suiHTLC = useCreateSuiHTLC();
  const autoUpdate = useSettingsStore((s) => s.autoUpdate);
  const targetChainId = meta.targetChainId as number;

  // Fetch hashlock from matcher's EVM HTLC
  useEffect(() => {
    if (!meta.matcherHtlcSwapId || !targetChainId) return;
    let cancelled = false;

    const fetchHashlock = async () => {
      try {
        const client = getPublicClient(targetChainId);
        const htlcAddress = getContractAddress(targetChainId, 'htlc') as `0x${string}`;
        const swapData = await client.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [meta.matcherHtlcSwapId as `0x${string}`],
        }) as any;
        if (!cancelled) setHashlock(swapData.hashlock as string);
      } catch (err) {
        console.warn('Failed to fetch hashlock from EVM HTLC:', err);
      }
    };

    fetchHashlock();
    if (!autoUpdate) return () => { cancelled = true; };
    const interval = setInterval(fetchHashlock, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [meta.matcherHtlcSwapId, targetChainId, autoUpdate]);

  const handleCreate = async () => {
    if (!suiAccount || !address || !hashlock || !meta.matcher) return;
    // Guard against zero hashlock — means EVM HTLC doesn't actually exist on-chain
    const ZERO_HASHLOCK = '0x' + '0'.repeat(64);
    if (hashlock === ZERO_HASHLOCK) {
      setError('EVM HTLC not found on-chain. The counterparty may not have locked tokens yet. Please refresh and try again.');
      return;
    }
    setError(null);

    try {
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
      const swapId = generateSwapIdCrossChain(
        suiAccount.address,
        meta.matcher,
        hashlock as `0x${string}`,
        timelock,
        'sui:testnet'
      );

      const result = await suiHTLC.createSwap({
        swapId,
        participant: meta.matcher, // Matcher's SUI address — they will withdraw to reveal secret
        hashlock: hashlock as `0x${string}`,
        timelock,
        tokenType: meta.sellToken,
        amount: BigInt(meta.sellAmount),
      });

      // Save to localStorage so determineSwapPhase can track creator's HTLC
      saveSwap(address, {
        orderId: meta.orderId,
        role: 'creator',
        sourceChainId: meta.sourceChainId,
        targetChainId: meta.targetChainId,
        hashlock,
        sellToken: meta.sellToken,
        sellAmount: meta.sellAmount,
        buyToken: meta.buyToken,
        buyAmount: meta.buyAmount,
        creator: meta.creator,
        matcher: meta.matcher,
        matcherHtlcSwapId: meta.matcherHtlcSwapId,
        creatorHtlcSwapId: swapId,
        creatorHtlcObjectId: result.htlcObjectId || undefined,
        createdAt: meta.createdAt,
        updatedAt: Date.now(),
      });

      toast.success('SUI counter-HTLC created! Waiting for counterparty to withdraw.');
      setIsDone(true);
      onUpdate();
    } catch (err: any) {
      console.error('SuiSourceCreatorCounterHTLCAction failed:', err);
      setError(err?.message || 'Failed to create SUI counter-HTLC');
    }
  };

  if (isDone) {
    return (
      <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
        SUI counter-HTLC created! Counterparty will withdraw to reveal the secret.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-300">
        Counterparty locked EVM tokens. Create a SUI counter-HTLC to continue the swap.
      </div>
      {!suiAccount && (
        <p className="text-xs text-yellow-400">Connect Slush (SUI) wallet to create counter-HTLC.</p>
      )}
      {!meta.matcher && (
        <p className="text-xs text-yellow-400">Matcher SUI address not yet synced. Click Refresh.</p>
      )}
      {!hashlock && meta.matcherHtlcSwapId && (
        <p className="text-xs text-gray-400">Reading hashlock from EVM HTLC...</p>
      )}
      {!meta.matcherHtlcSwapId && (
        <p className="text-xs text-yellow-400">EVM HTLC swap ID not found. Try refreshing.</p>
      )}
      {error && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>}
      <Button
        size="sm"
        variant="primary"
        loading={suiHTLC.isPending}
        onClick={handleCreate}
        disabled={suiHTLC.isPending || !suiAccount || !hashlock || !meta.matcher}
      >
        {suiHTLC.isPending ? 'Creating SUI HTLC...' : 'Create SUI Counter-HTLC'}
      </Button>
    </div>
  );
}

/**
 * Complete order on CCOB after both sides have withdrawn
 */
function CompleteAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { meta } = swap;
  const [error, setError] = useState<string | null>(null);

  const isSuiSource = typeof meta.sourceChainId === 'string';

  // useCompleteOrder is EVM-only (calls CCOB.completeOrder). For SUI source chains,
  // the order lives on the SUI order book — no EVM CCOB to complete.
  const { completeOrder, isPending, isConfirming, isSuccess } = useCompleteOrder(
    isSuiSource ? 0 : (meta.sourceChainId as number)
  );

  useEffect(() => {
    if (isSuccess) {
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  // SUI source chains don't have an EVM CCOB to complete — swap is already done
  if (isSuiSource) {
    return <Badge variant="success">Swap Completed</Badge>;
  }

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
