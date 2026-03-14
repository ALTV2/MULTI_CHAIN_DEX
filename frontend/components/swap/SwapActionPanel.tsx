'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCreateHTLCSwap, useWithdrawHTLC, useRefundHTLC, generateSecret, generateHashlock, generateSwapId } from '@/hooks/useHTLC';
import { useWithdrawSuiHTLC, useRefundSuiHTLC } from '@/hooks/useSuiHTLC';
import { useCancelSuiOrder } from '@/hooks/useSuiOrders';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useCompleteOrder } from '@/hooks/useCompleteOrder';
import { useUnifiedSecretWatcher } from '@/hooks/useUnifiedSecretWatcher';
import { useReactivateCrossChainOrder } from '@/hooks/useCrossChainOrders';
import { updateSwap } from '@/lib/utils/swapStorage';
import { getRequiredChain } from '@/lib/utils/swapPhase';
import { getContractAddress, chainConfig, SupportedChainId, getExplorerTxUrl } from '@/lib/contracts/addresses';
import { isNativeToken } from '@/lib/constants/tokens';
import { getSecretStrategy } from '@/lib/secrets';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { buildSwapKey } from '@/lib/secrets/SecretStorageStrategy';
import { orderBookABI } from '@/lib/contracts/abis/OrderBook';
import { CROSS_CHAIN_ORDER_BOOK_ABI } from '@/lib/contracts/abis/CrossChainOrderBook';
import type { ActiveSwap } from '@/types/swap';
import { toast } from 'sonner';
import { getPublicClient } from '@/lib/utils/rpcClient';

interface DetectedHTLC {
  swapId: `0x${string}`;
  initiator: `0x${string}`;
  participant: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  hashlock: `0x${string}`;
  timelock: bigint;
  blockNumber: bigint;
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
    case 'order_matched':
      if (role === 'creator') return <CreatorLockAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for the initiator to lock tokens..." />;
    case 'creator_htlc_created':
      if (role === 'matcher') return <MatcherLockAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for counterparty to lock tokens..." />;
    case 'matcher_htlc_created':
      if (role === 'creator') return <CreatorWithdrawAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for the initiator to claim tokens..." />;
    case 'secret_revealed':
      if (role === 'matcher') return <MatcherWithdrawAction swap={swap} onUpdate={onUpdate} />;
      return <WaitingMessage text="Waiting for counterparty to complete..." />;
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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: cancelTxHash,
  });

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
      console.log('✅ Order cancelled successfully, refreshing...');
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
    console.log('🗑️ Attempting to cancel order:', {
      orderId: swap.meta.orderId,
      isSameChain,
      currentChainId: evmChainId,
      orderChainId,
      needsSwitch: needsChainSwitch
    });

    try {
      // For SUI orders, use SUI cancellation logic
      if (typeof orderChainId === 'string' && orderChainId.includes('sui')) {
        if (!suiAccount) {
          const msg = 'Please connect a SUI wallet to cancel this order';
          setError(msg);
          toast.error(msg);
          return;
        }

        // Extract numeric order ID from "sui-X" format
        const numericOrderId = swap.meta.orderId.replace('sui-', '');
        console.log('🗑️ Cancelling SUI order:', numericOrderId);

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

      console.log('📝 Contract details:', {
        address: contractAddress,
        contractType: isSameChain ? 'OrderBook' : 'CrossChainOrderBook',
        chainId: orderChainId,
      });

      // ⚠️ DEBUG: Check order status before cancellation
      const client = getPublicClient(orderChainId);
      const orderData = await client.readContract({
        address: contractAddress,
        abi,
        functionName: 'getOrder',
        args: [BigInt(swap.meta.orderId)],
      }) as any;

      const statusMap = ['Active', 'Matched', 'Completed', 'Cancelled', 'Expired'];
      const currentStatus = statusMap[orderData.status] || `Unknown(${orderData.status})`;

      console.log('🔍 Current order status:', {
        orderId: swap.meta.orderId,
        status: currentStatus,
        statusCode: orderData.status,
        creator: orderData.creator,
        yourAddress: address,
        isCreator: orderData.creator?.toLowerCase() === address?.toLowerCase(),
      });

      if (orderData.status !== 0) { // 0 = Active
        const msg = `Cannot cancel: Order is ${currentStatus}`;
        console.error('❌', msg);
        toast.error(msg);
        setError(msg);
        return;
      }

      if (orderData.creator?.toLowerCase() !== address?.toLowerCase()) {
        const msg = 'You are not the creator of this order';
        console.error('❌', msg);
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

      console.log('✅ Cancel transaction submitted:', hash);

      // Get explorer URL
      const explorerUrl = getExplorerTxUrl(orderChainId, hash);
      console.log('🔗 Transaction URL:', explorerUrl);

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
      console.error('❌ Cancel failed:', err);
      const errorMsg = err?.shortMessage || err?.message || 'Failed to cancel order';
      console.error('Error details:', errorMsg);
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-3">
      {/* If HTLC detected on target chain, show action to create counter-HTLC */}
      {detectedHTLC && swap.meta.role === 'creator' ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-300">
            ✅ A matcher created an HTLC on {chainConfig[swap.meta.targetChainId as SupportedChainId]?.shortName || 'the target chain'}.
            Create your counter-HTLC on {chainConfig[swap.meta.sourceChainId as SupportedChainId]?.shortName || 'your chain'} to continue the swap.
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              // TODO: Implement create counter-HTLC logic
              toast.info('Create counter-HTLC functionality coming soon!');
            }}
          >
            Create Counter-HTLC on {chainConfig[swap.meta.sourceChainId as SupportedChainId]?.shortName}
          </Button>
        </div>
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
 * Creator locks tokens in HTLC on source chain (48h timelock)
 */
function CreatorLockAction({ swap, onUpdate }: { swap: ActiveSwap; onUpdate: () => void }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { meta, phase } = swap;
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approving' | 'locking' | 'done'>('idle');
  const [reactivateTxHash, setReactivateTxHash] = useState<`0x${string}` | undefined>();

  const sourceChainId = meta.sourceChainId;
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
  const { isLoading: isReactivateConfirming, isSuccess: isReactivateSuccess } = useWaitForTransactionReceipt({
    hash: reactivateTxHash,
  });

  const isReactivating = !!reactivateTxHash && !isReactivateSuccess;

  useEffect(() => {
    if (isSuccess) {
      setStep('done');
      onUpdate();
    }
  }, [isSuccess, onUpdate]);

  useEffect(() => {
    if (isReactivateSuccess && reactivateTxHash && onUpdate) {
      console.log('✅ Order reactivated successfully');
      toast.success('Match cancelled! Your order is back in the order book.');
      setReactivateTxHash(undefined);
      onUpdate();
    }
  }, [isReactivateSuccess, reactivateTxHash, onUpdate]);

  const handleCancelMatch = async () => {
    setError(null);
    console.log('🔄 Attempting to cancel match and reactivate order:', {
      orderId: meta.orderId,
      currentChainId: chainId,
      orderChainId: sourceChainId,
    });

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

      console.log('🔍 Current order status:', {
        orderId: meta.orderId,
        status: currentStatus,
        statusCode: orderData.status,
      });

      if (orderData.status !== 1) {
        const msg = `Cannot reactivate: Order is ${currentStatus}, not Matched`;
        console.error('❌', msg);
        toast.error(msg);
        setError(msg);
        return;
      }

      if (orderData.creator?.toLowerCase() !== address?.toLowerCase()) {
        const msg = 'You are not the creator of this order';
        console.error('❌', msg);
        toast.error(msg);
        setError(msg);
        return;
      }

      const expiresAt = Number(orderData.expiresAt);
      const now = Math.floor(Date.now() / 1000);
      if (now >= expiresAt) {
        const msg = 'Order has expired and cannot be reactivated';
        console.error('❌', msg);
        toast.error(msg);
        setError(msg);
        return;
      }

      const isPolygon = sourceChainId === 80002;
      const gasConfig = isPolygon
        ? {
            gas: 300000n,
            maxFeePerGas: 50000000000n,
            maxPriorityFeePerGas: 50000000000n,
          }
        : {
            gas: 300000n,
          };

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: CROSS_CHAIN_ORDER_BOOK_ABI,
        functionName: 'reactivateOrder',
        args: [BigInt(meta.orderId)],
        ...gasConfig,
      });

      console.log('✅ Reactivate transaction submitted:', hash);
      const explorerUrl = getExplorerTxUrl(sourceChainId, hash);
      setReactivateTxHash(hash);

      toast.info(
        <div>
          Transaction submitted!
          <br />
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs mt-1 inline-block">
            View on explorer →
          </a>
        </div>,
        { duration: 10000 }
      );

    } catch (err: any) {
      console.error('❌ Cancel match failed:', err);
      const errorMsg = err?.shortMessage || err?.message || 'Failed to cancel match';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleLock = async () => {
    if (!address) return;

    if (!meta.matcher) {
      setError('Matcher address not yet synced. Click Refresh and try again.');
      onUpdate();
      return;
    }

    setError(null);

    try {
      let secret = meta.secret as `0x${string}` | undefined;
      let hashlock = meta.hashlock as `0x${string}`;

      if (!secret) {
        secret = generateSecret();
        hashlock = generateHashlock(secret);
        updateSwap(address, meta.orderId, { secret, hashlock }, meta.sourceChainId);

        const strategy = getSecretStrategy(useSettingsStore.getState().secretStorage);
        const swapKey = buildSwapKey(address, meta.orderId, meta.sourceChainId);
        await strategy.saveSecret(swapKey, secret);
      }

      if (needsApproval && !isApproved) {
        setStep('approving');
        await approve();
      }

      setStep('locking');
      const timelock = BigInt(Math.floor(Date.now() / 1000) + 48 * 3600);
      const swapId = generateSwapId(
        address,
        meta.matcher as `0x${string}`,
        hashlock,
        timelock,
        sourceChainId
      );

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
      {/* Show matched info for order_matched phase */}
      {phase === 'order_matched' && (
        <>
          <div className="text-sm text-gray-400">
            Your order has been matched! You can proceed to lock your tokens or cancel the match to return the order to the order book.
          </div>
          <div className="text-xs text-gray-500">
            Matched by: <span className="font-mono">{meta.matcher.slice(0, 6)}...{meta.matcher.slice(-4)}</span>
          </div>
        </>
      )}

      {error && (
        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}

      {step === 'done' || isSuccess ? (
        <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs">
          Tokens locked in HTLC successfully!
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Show Cancel Match button only for order_matched phase */}
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
            disabled={isApproving || isCreating || isConfirming || isReactivating || isReactivateConfirming}
          >
            {isApproving
              ? 'Approving...'
              : isCreating || isConfirming
              ? 'Locking Tokens...'
              : needsApproval
              ? 'Approve & Lock Tokens'
              : 'Lock Tokens in HTLC'}
          </Button>
        </div>
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
  const htlcAddress = getContractAddress(targetChainId, 'htlc') as `0x${string}`;
  const buyAmount = BigInt(meta.buyAmount);
  const buyToken = meta.buyToken as `0x${string}`;
  const isNative = isNativeToken(targetChainId, buyToken);

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

    console.log('🔒 [MatcherLockAction] Starting lock process:', {
      orderId: meta.orderId,
      role: meta.role,
      hashlock: meta.hashlock,
      targetChainId,
      buyToken,
      buyAmount: buyAmount.toString(),
    });

    try {
      // Use the same hashlock from the creator's HTLC (synced from on-chain by useActiveSwaps)
      if (!meta.hashlock || meta.hashlock === '' || meta.hashlock === '0x') {
        console.error('❌ [MatcherLockAction] Hashlock not available:', meta.hashlock);
        setError('Hashlock not yet synced from creator\'s HTLC. Click Refresh and try again.');
        onUpdate();
        return;
      }
      const hashlock = meta.hashlock as `0x${string}`;
      console.log('✅ [MatcherLockAction] Hashlock validated:', hashlock);

      // Step 1: Approve if needed
      if (needsApproval && !isApproved) {
        console.log('🔐 [MatcherLockAction] Approval needed, requesting approval...');
        setStep('approving');
        await approve();
        console.log('✅ [MatcherLockAction] Approval completed');
      } else {
        console.log('✅ [MatcherLockAction] No approval needed or already approved');
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

      console.log('📝 [MatcherLockAction] Generated swap details:', {
        swapId,
        participant: meta.creator,
        hashlock,
        timelock: timelock.toString(),
        token: buyToken,
        amount: buyAmount.toString(),
      });

      // Save matcherHtlcSwapId before tx
      updateSwap(address, meta.orderId, { matcherHtlcSwapId: swapId }, meta.sourceChainId);
      console.log('💾 [MatcherLockAction] Saved matcherHtlcSwapId to localStorage');

      console.log('🚀 [MatcherLockAction] Creating HTLC swap...');
      await createSwap({
        swapId,
        participant: meta.creator as `0x${string}`,
        hashlock,
        timelock,
        token: buyToken,
        amount: buyAmount,
      });
      console.log('✅ [MatcherLockAction] HTLC created successfully!');
    } catch (err: any) {
      console.error('❌ [MatcherLockAction] Lock failed:', err);
      console.error('Error details:', {
        message: err?.message,
        shortMessage: err?.shortMessage,
        code: err?.code,
        data: err?.data,
      });
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
  // Works with both EVM and SUI chains
  const { secret: revealedSecret, isLoading: isSearching } = useUnifiedSecretWatcher(
    targetChainId,
    meta.matcherHtlcSwapId as `0x${string}` | undefined,
    true
  );

  // Use appropriate withdraw hook based on source chain type
  const isEvmSource = typeof sourceChainId === 'number';
  const evmWithdraw = useWithdrawHTLC(isEvmSource ? sourceChainId : 0);
  const suiWithdraw = useWithdrawSuiHTLC();

  const { withdraw, isPending, isConfirming, isSuccess } = isEvmSource
    ? evmWithdraw
    : {
        withdraw: async (swapId: string, secret: string) => {
          // For SUI, we need swapObjectId instead of swapId
          // This should be passed from the swap metadata
          if (!meta.creatorHtlcSwapId) throw new Error('Missing swap object ID');
          return suiWithdraw.withdraw({
            swapObjectId: meta.creatorHtlcSwapId,
            secret: secret as `0x${string}`,
            tokenType: meta.sellToken, // SUI token type
          });
        },
        isPending: suiWithdraw.isPending,
        isConfirming: false,
        isSuccess: false, // SUI doesn't have separate success state
      };

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
