'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TargetWalletSelector } from '@/components/swap/TargetWalletSelector';
import { useMatchCrossChainOrder } from '@/hooks/useCrossChainOrders';
import { useExecuteOrder } from '@/hooks/useExecuteOrder';
import { useCreateSuiHTLC } from '@/hooks/useSuiHTLC';
import { useMatchSuiOrder } from '@/hooks/useSuiOrders';
import { useFillSuiSameChainOrder } from '@/hooks/useSuiSameChainOrders';
import { getKnownPairs } from '@/lib/sui/pairRegistry';
import { useCreateHTLCSwap } from '@/hooks/useHTLC';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import type { UnifiedOrder } from '@/types/order-unified';
import { getContractAddress, getChainConfig, getExplorerTxUrl } from '@/lib/contracts/addresses';
import { isNativeToken, getTokenByAddress, evmPlaceholderToSuiToken } from '@/lib/constants/tokens';
import { saveSwap } from '@/lib/utils/swapStorage';
import { generateSecret, generateHashlock, generateSwapId, calculateTimelock } from '@/lib/utils/crossChainCrypto';
import { formatAmount } from '@/lib/utils/formatAmount';
import { toast } from 'sonner';
import { ZERO_BYTES32 } from '@/lib/constants/swap';
import { useAttachOrderMetadata } from '@/hooks/useDexApi';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface MatchOrderModalProps {
  open: boolean;
  onClose: () => void;
  order: UnifiedOrder | null;
  sourceChainId: number | string;
}

export function MatchOrderModal({ open, onClose, order, sourceChainId }: MatchOrderModalProps) {
  const { address } = useAccount();
  const suiAccount = useCurrentAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const notificationEmail = useSettingsStore((s) => s.notificationEmail);
  const attachMetadata = useAttachOrderMetadata();
  const [targetWallet, setTargetWallet] = useState('');
  const [swapSecret, setSwapSecret] = useState<`0x${string}` | null>(null);
  const [pendingSwapData, setPendingSwapData] = useState<any>(null);
  // For SUI→EVM: creator's EVM address where they'll receive tokens.
  // Initialized from order.targetAddress if it's valid EVM, otherwise empty (user must enter).
  const [creatorEvmAddress, setCreatorEvmAddress] = useState('');

  // targetChainIdNum is already properly set ('sui:testnet' or number) from useAllOrders
  const targetChainId = order?.targetChainIdNum ?? sourceChainId;
  const isSameChain = sourceChainId === targetChainId;

  // Detect SUI chains
  const isSuiSource = typeof sourceChainId === 'string';
  const isSuiTarget = typeof targetChainId === 'string';
  const isSuiSwap = isSuiSource || isSuiTarget;

  // Hooks for different order types
  // NOTE: crossChainHook requires number chainId, pass sepolia.id as fallback for SUI (won't be used)
  const crossChainHook = useMatchCrossChainOrder(typeof sourceChainId === 'number' ? sourceChainId : 11155111);
  const sameChainHook = useExecuteOrder();
  const suiHTLCHook = useCreateSuiHTLC();
  const suiMatchHook = useMatchSuiOrder();

  // For SUI → EVM: Create HTLC directly on EVM (target chain)
  const evmTargetChainId = typeof targetChainId === 'number' ? targetChainId : 11155111;
  const evmHTLCHook = useCreateHTLCSwap(evmTargetChainId);

  // ERC20 approval for SUI→EVM matcher (locks EVM tokens in HTLC)
  // SUI orders store amounts in 9 decimals — scale to EVM token decimals for approval
  const matcherBuyToken = order?.buyToken as `0x${string}` | undefined;
  const matcherBuyTokenInfo = matcherBuyToken ? getTokenByAddress(evmTargetChainId, matcherBuyToken) : undefined;
  const matcherBuyDecimals = matcherBuyTokenInfo?.decimals ?? 18;
  const CROSS_CHAIN_DECIMALS = 9;
  const matcherBuyAmountScaled = (order?.buyAmount ?? 0n) * BigInt(10 ** (matcherBuyDecimals - CROSS_CHAIN_DECIMALS));
  const htlcAddressForApproval = (() => {
    try { return getContractAddress(evmTargetChainId, 'htlc') as `0x${string}`; }
    catch { return '0x0000000000000000000000000000000000000000' as `0x${string}`; }
  })();
  const isNativeBuyToken = matcherBuyToken ? isNativeToken(evmTargetChainId, matcherBuyToken) : true;
  const { needsApproval, approve, isApproving, isApproved } = useTokenApproval(
    isSuiSource && !isSameChain && matcherBuyToken && !isNativeBuyToken ? matcherBuyToken : undefined,
    htlcAddressForApproval,
    matcherBuyAmountScaled
  );
  const [secretSaved, setSecretSaved] = useState(false);

  const sourceConfig = getChainConfig(sourceChainId);
  const targetConfig = getChainConfig(targetChainId);

  // Safety check: if targetConfig is undefined (SUI case), provide defaults
  const safeTargetConfig = targetConfig || { shortName: 'SUI', color: '#4DA2FF', name: 'SUI (Testnet)' };

  // Validate EVM address format (0x + 40 hex chars)
  const isValidEvmAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  // Reset state when modal opens; pre-fill creator's EVM address if stored and valid
  useEffect(() => {
    if (open) {
      setSwapSecret(null);
      setPendingSwapData(null);
      const stored = order?.targetAddress ?? '';
      setCreatorEvmAddress(isValidEvmAddress(stored) ? stored : '');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set target wallet based on swap direction
  useEffect(() => {
    if (isSuiSource && suiAccount?.address) {
      // SUI → EVM: Use matcher's SUI address for receiving
      setTargetWallet(suiAccount.address);
    } else if (!isSuiSource && address) {
      // EVM → *: Use connected EVM address as receiving address
      setTargetWallet(address);
    }
  }, [address, suiAccount, isSuiSource]);

  const fillSuiSameChainHook = useFillSuiSameChainOrder();
  const isSuiSameChain = isSuiSource && isSuiTarget;

  // Cross-chain SUI swaps require BOTH wallets:
  // SUI→EVM: matcher creates HTLC on EVM (needs EVM) and receives SUI (needs Slush)
  // EVM→SUI: matcher creates HTLC on SUI (needs Slush) and receives EVM tokens (needs MetaMask)
  const needsBothWallets = !isSuiSameChain && isSuiSwap;
  const bothWalletsConnected = !!address && !!suiAccount;

  // For EVM → EVM: matchOrder is called on the SOURCE chain CCOB, so wallet must be on source chain.
  // For EVM → SUI: matchOrder also called on source chain (EVM), same rule.
  // For SUI → EVM: handled separately via evmHTLCHook on target chain.
  const requiredChainForMatch = isSuiSource
    ? (typeof targetChainId === 'number' ? targetChainId : null) // SUI→EVM: EVM HTLC on target
    : (typeof sourceChainId === 'number' ? sourceChainId : null); // EVM→*: matchOrder on source

  // Handle success for cross-chain orders
  useEffect(() => {
    if (crossChainHook.isSuccess && order && address && !isSameChain) {
      const orderId = order.id.toString();
      saveSwap(address, {
        orderId,
        role: 'matcher',
        sourceChainId,
        targetChainId,
        hashlock: '',
        sellToken: order.sellToken,
        sellAmount: order.sellAmount.toString(),
        buyToken: order.buyToken,
        buyAmount: order.buyAmount.toString(),
        creator: order.creator,
        matcher: address,
        targetAddress: order.targetAddress,
        creatorSuiAddress: isSuiTarget ? order.targetAddress : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Attach off-chain matcher metadata: the matcher's full target-side address
      // (their SUI address for EVM→SUI, which doesn't fit on-chain) + opt-in email.
      attachMetadata.mutate({
        chainId: String(sourceChainId),
        onChainOrderId: orderId,
        orderType: 'CROSS_CHAIN',
        role: 'matcher',
        targetAddress: isSuiTarget ? suiAccount?.address : address,
        email: notificationEmail || undefined,
      });
      toast.success('Order matched successfully!');
      onClose();
    }
  }, [crossChainHook.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle success for same-chain orders
  useEffect(() => {
    if (sameChainHook.isSuccess && order && isSameChain) {
      toast.success('Order executed successfully!');

      // Reset hook state and close modal
      setTimeout(() => {
        sameChainHook.reset();
        onClose();
      }, 1000);
    }
  }, [sameChainHook.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle success for SUI → EVM orders
  useEffect(() => {
    if (evmHTLCHook.isSuccess && order && isSuiSource && !isSameChain && pendingSwapData) {

      // Now that transaction is confirmed, set the secret and show success
      setSwapSecret(pendingSwapData.secret);

      toast.success(
        suiAccount
          ? 'HTLC created on EVM! Save your secret to complete the swap.'
          : 'HTLC created on EVM! Provide your SUI address to the order creator so they can create the counter-HTLC on SUI.'
      );

      // Save swap data after confirmation
      const userAddress = address!;
      // For SUI → EVM: matcher receives SUI tokens, so targetAddress is matcher's SUI address
      const matcherSuiAddress = targetWallet || suiAccount?.address || ''; // Matcher's SUI address for receiving
      saveSwap(userAddress, {
        orderId: order.id.toString(),
        role: 'matcher',
        sourceChainId: sourceChainId,
        targetChainId: targetChainId,
        hashlock: pendingSwapData.hashlock,
        secret: pendingSwapData.secret,
        sellToken: order.sellToken,
        sellAmount: order.sellAmount.toString(),
        buyToken: order.buyToken,
        buyAmount: order.buyAmount.toString(),
        creator: order.creator,
        creatorEvmAddress: order.targetAddress, // Creator's EVM address from order (HTLC participant)
        matcher: userAddress,
        targetAddress: matcherSuiAddress, // Matcher's SUI address for receiving SUI tokens
        // Save the EVM HTLC swapId so matcher can track their HTLC and phase inference works
        matcherHtlcSwapId: pendingSwapData.swapId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Attach off-chain matcher metadata: matcher's full SUI receiving address + opt-in email.
      // The order lives on the SUI source chain, so it's keyed by the SUI chain ID.
      attachMetadata.mutate({
        chainId: String(sourceChainId),
        onChainOrderId: order.id.toString(),
        orderType: 'CROSS_CHAIN',
        role: 'matcher',
        targetAddress: matcherSuiAddress || undefined,
        email: notificationEmail || undefined,
      });

      // Clear pending data
      setPendingSwapData(null);

      // Do NOT auto-close — user must confirm they saved the secret
    }
  }, [evmHTLCHook.isSuccess, pendingSwapData]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const sellToken = getTokenByAddress(sourceChainId, order.sellToken);
  // For EVM→SUI: buyToken is an EVM placeholder — resolve back to SUI token
  const resolvedBuyTokenAddr = isSuiTarget
    ? evmPlaceholderToSuiToken(order.buyToken) || order.buyToken
    : order.buyToken;
  const buyToken = getTokenByAddress(targetChainId, resolvedBuyTokenAddr);
  const needsChainSwitch = requiredChainForMatch !== null && currentChainId !== requiredChainForMatch;

  // Validate SUI address format (starts with 0x, at least 1 hex char, up to 64 hex chars)
  const isValidSuiAddress = (addr: string) => {
    return /^0x[a-fA-F0-9]{1,64}$/.test(addr);
  };

  // Check if targetWallet is valid for the required chain
  // For SUI → EVM: need matcher's SUI address (validate as SUI)
  // For EVM → *: need receiving address on source chain
  const isTargetWalletValid = isSuiSource
    ? (targetWallet && isValidSuiAddress(targetWallet))
    : !!targetWallet;

  const isPending = isSuiSameChain
    ? fillSuiSameChainHook.isPending
    : isSameChain
    ? sameChainHook.isExecuting
    : isSuiSource
    ? evmHTLCHook.isPending || suiMatchHook.isPending // SUI → EVM: EVM HTLC + optional SUI matchOrder
    : isSuiTarget
    ? suiHTLCHook.isPending || crossChainHook.isPending // EVM → SUI: EVM matchOrder + SUI HTLC
    : crossChainHook.isPending; // EVM → EVM
  const isConfirming = isSameChain
    ? false
    : isSuiSource
    ? evmHTLCHook.isConfirming // SUI → EVM: wait for EVM HTLC confirmation
    : isSuiTarget
    ? false // EVM → SUI: no confirmation needed (handled by hooks)
    : crossChainHook.isConfirming; // EVM → EVM
  const error = isSameChain
    ? sameChainHook.error
    : isSuiSource
    ? evmHTLCHook.error || suiMatchHook.error // SUI → EVM errors
    : isSuiTarget
    ? suiHTLCHook.error || crossChainHook.error // EVM → SUI errors
    : crossChainHook.error; // EVM → EVM errors

  // ── Strategy: one async function per swap type ────────────────────────────

  async function strategySuiSameChain() {
    if (!order!.suiSameChainMeta) {
      toast.error('Missing SUI order metadata');
      return;
    }
    const pairConfig = getKnownPairs().find((p) => p.pairId === order!.suiSameChainMeta!.pairId);
    if (!pairConfig) {
      toast.error('Unknown SUI trading pair');
      return;
    }
    await fillSuiSameChainHook.fillOrder({
      orderId: Number(order!.id),
      orderObjectId: order!.suiSameChainMeta.orderObjectId,
      creator: order!.creator,
      sellAmount: order!.sellAmount,
      buyAmount: order!.buyAmount,
      status: 'Active',
      pairConfig,
    });
    toast.success('Order filled successfully!');
    onClose();
  }

  async function strategyEvmSameChain() {
    await sameChainHook.executeOrder({
      orderId: order!.id,
      tokenToBuy: order!.buyToken as `0x${string}`,
      buyAmount: order!.buyAmount,
    });
  }

  async function strategySuiToEvm(userAddress: string) {
    // SUI → EVM: Matcher creates HTLC on EVM (target chain) locking EVM tokens
    const secret = generateSecret();
    const hashlock = generateHashlock(secret);
    const timelock = calculateTimelock(true);
    const swapId = generateSwapId(
      userAddress,
      order!.creator,
      hashlock,
      timelock,
      targetChainId
    );

    setPendingSwapData({ secret, hashlock, swapId });

    if (needsApproval && !isApproved) {
      toast.info('Approving token for HTLC contract...');
      await approve();
      toast.success('Token approved!');
    }

    if (!isValidEvmAddress(creatorEvmAddress)) {
      toast.error('Enter a valid EVM address for the order creator');
      return;
    }

    // SUI orders store amounts in 9 decimals (u64 safety); scale to EVM token decimals.
    const evmTokenInfo = getTokenByAddress(evmTargetChainId, order!.buyToken);
    const evmDecimals = evmTokenInfo?.decimals ?? 18;
    const CROSS_CHAIN_DECIMALS = 9;
    const scaledAmount = order!.buyAmount * BigInt(10 ** (evmDecimals - CROSS_CHAIN_DECIMALS));

    await evmHTLCHook.createSwap({
      swapId,
      participant: creatorEvmAddress as `0x${string}`,
      hashlock,
      timelock,
      token: order!.buyToken as `0x${string}`,
      amount: scaledAmount,
    });

    // Best-effort: also mark the SUI order as matched if SUI wallet is connected.
    if (suiAccount) {
      try {
        await suiMatchHook.matchOrder(order!.id.toString(), swapId);
      } catch (err) {
        console.warn('Failed to mark order as matched on SUI:', err);
        toast.warning('HTLC created, but could not update order status on SUI. Ask creator to verify HTLC manually.');
      }
    }
  }

  async function strategyEvmToSui(userAddress: string) {
    // EVM → SUI: call matchOrder on EVM CCOB to register the match
    const secret = generateSecret();
    const hashlock = generateHashlock(secret);
    const timelock = calculateTimelock(true);
    const swapId = generateSwapId(
      userAddress,
      order!.creator,
      hashlock,
      timelock,
      sourceChainId
    );

    await crossChainHook.matchOrder(order!.id, swapId);

    toast.success('Order matched! Waiting for creator to lock tokens on EVM, then you lock SUI tokens.');

    // Save swap data — include creatorSuiAddress so MatcherLockAction knows where to send SUI
    if (address) {
      saveSwap(address, {
        orderId: order!.id.toString(),
        role: 'matcher',
        sourceChainId: sourceChainId,
        targetChainId: targetChainId,
        hashlock,
        secret,
        sellToken: order!.sellToken,
        sellAmount: order!.sellAmount.toString(),
        buyToken: order!.buyToken,
        buyAmount: order!.buyAmount.toString(),
        creator: order!.creator,
        matcher: address,
        creatorSuiAddress: order!.targetAddress,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  async function strategyEvmCrossChain() {
    await crossChainHook.matchOrder(order!.id, ZERO_BYTES32 as `0x${string}`);
  }

  async function handleAction() {
    if (!order) return;

    // Matcher is always on the target side — check the right wallet.
    const userAddress = isSuiTarget ? suiAccount?.address : address;
    if (!userAddress) {
      toast.error(`Please connect your ${isSuiTarget ? 'SUI' : 'EVM'} wallet`);
      return;
    }

    if (needsChainSwitch && requiredChainForMatch !== null) {
      try {
        toast.info(`Switching to ${getChainConfig(requiredChainForMatch)?.shortName}...`);
        await switchChainAsync({ chainId: requiredChainForMatch });
      } catch (err: any) {
        toast.error(`Failed to switch network: ${err?.shortMessage || err?.message || 'unknown error'}`);
      }
      return;
    }

    try {
      // Dispatch to the right strategy based on swap type.
      if (isSuiSameChain) {
        await strategySuiSameChain();
      } else if (isSameChain) {
        await strategyEvmSameChain();
      } else if (isSuiSource) {
        await strategySuiToEvm(userAddress);
      } else if (isSuiTarget) {
        await strategyEvmToSui(userAddress);
      } else {
        await strategyEvmCrossChain();
      }
    } catch (error: any) {
      console.error('Error matching order:', error);
      toast.error(error.message || 'Failed to match order');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSameChain ? "Execute Order" : "Match Order"}
      className="max-w-lg"
    >
      <div className="space-y-5">
        {/* Order summary */}
        <div className="p-4 bg-light-hover dark:bg-dark-hover rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">You receive</span>
            <Badge variant="info" style={{ color: sourceConfig?.color }}>
              {sourceConfig?.shortName}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatAmount(order.sellAmount, sourceChainId, sellToken?.decimals, sourceChainId)}{' '}
            <span className="text-lg text-gray-400">{sellToken?.symbol || '???'}</span>
          </div>

          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">You send</span>
            <Badge variant="success" style={{ color: isSameChain ? sourceConfig?.color : safeTargetConfig.color }}>
              {isSameChain ? sourceConfig?.shortName : safeTargetConfig.shortName}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatAmount(order.buyAmount, targetChainId, buyToken?.decimals, sourceChainId)}{' '}
            <span className="text-lg text-gray-400">{buyToken?.symbol || '???'}</span>
          </div>
        </div>

        {/* Target wallet - only for cross-chain EVM orders (SUI uses connected wallet automatically) */}
        {!isSameChain && !isSuiSource && (
          <TargetWalletSelector
            targetChainId={sourceChainId}
            value={targetWallet}
            onChange={setTargetWallet}
          />
        )}

        {/* Both wallets required banner for cross-chain SUI swaps */}
        {needsBothWallets && (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${address ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
              <span>{address ? '✅' : '❌'}</span>
              <span>MetaMask {address ? `(${address.slice(0, 6)}…${address.slice(-4)})` : '— not connected'}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${suiAccount ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
              <span>{suiAccount ? '✅' : '❌'}</span>
              <span>Slush (SUI) {suiAccount ? `(${suiAccount.address.slice(0, 6)}…${suiAccount.address.slice(-4)})` : '— not connected'}</span>
            </div>
            {!bothWalletsConnected && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cross-chain SUI swaps require both wallets connected simultaneously.
              </p>
            )}
          </div>
        )}

        {/* Show matcher's SUI receiving address for SUI → EVM swaps (read-only when wallet connected) */}
        {!isSameChain && isSuiSource && suiAccount && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Your SUI address (where you'll receive {sellToken?.symbol || 'tokens'})
            </label>
            <div className="p-3 bg-light-hover dark:bg-dark-hover rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Connected SUI Wallet</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                {suiAccount.address}
              </p>
            </div>
          </div>
        )}

        {/* Creator's EVM receiving address for SUI → EVM swaps */}
        {!isSameChain && isSuiSource && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Creator's EVM address (where they'll receive {buyToken?.symbol || 'EVM tokens'})
            </label>
            {isValidEvmAddress(creatorEvmAddress) ? (
              <div className="p-3 bg-light-hover dark:bg-dark-hover rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">From order</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{creatorEvmAddress}</p>
                <button
                  className="text-xs text-accent-blue mt-1 hover:underline"
                  onClick={() => setCreatorEvmAddress('')}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="0x... (ask the order creator for their EVM address)"
                  value={creatorEvmAddress}
                  onChange={(e) => setCreatorEvmAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                />
                {creatorEvmAddress && !isValidEvmAddress(creatorEvmAddress) && (
                  <p className="text-xs text-accent-red">Invalid EVM address (must be 0x + 40 hex chars)</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  The order was created without a valid EVM receiving address. Ask the creator for their MetaMask address.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Secret display for SUI swaps */}
        {swapSecret && isSuiSwap && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <div className="flex items-start gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  ⚠️ Save Your Secret!
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
                  You will need this secret to claim your tokens. Keep it safe!
                </p>
                <div className="p-2 bg-white dark:bg-gray-900 rounded border border-yellow-300 dark:border-yellow-700">
                  <p className="text-xs font-mono break-all text-gray-900 dark:text-gray-100">{swapSecret}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(swapSecret);
                    toast.success('Secret copied to clipboard!');
                  }}
                >
                  Copy Secret
                </Button>
                <label className="flex items-center gap-2 cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    checked={secretSaved}
                    onChange={(e) => setSecretSaved(e.target.checked)}
                    className="w-4 h-4 accent-yellow-400"
                  />
                  <span className="text-xs text-yellow-800 dark:text-yellow-300">I have saved my secret</span>
                </label>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  disabled={!secretSaved}
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction hash link */}
        {(sameChainHook.txHash || crossChainHook.hash) && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Transaction submitted</p>
            <a
              href={getExplorerTxUrl(
                sourceChainId,
                (isSameChain ? sameChainHook.txHash : crossChainHook.hash) || ''
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
            >
              View on Explorer →
            </a>
          </div>
        )}

        {error && (
          <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl">
            <p className="text-sm text-accent-red">
              {typeof error === 'string' ? error : error.message || 'Transaction failed'}
            </p>
          </div>
        )}

        {/* Pre-flight expiration check */}
        {order?.expiresAt && order.expiresAt < BigInt(Math.floor(Date.now() / 1000)) && (
          <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            This order has expired and cannot be matched.
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          onClick={handleAction}
          loading={isPending || isConfirming || !!(sameChainHook.txHash || crossChainHook.hash)}
          disabled={
            (isSuiSameChain ? !suiAccount : needsBothWallets ? !bothWalletsConnected : isSuiTarget ? !suiAccount : !address) ||
            (!isSuiSameChain && !isSameChain && !needsBothWallets && !isTargetWalletValid) ||
            (isSuiSource && !isSameChain && !isValidEvmAddress(creatorEvmAddress)) ||
            !!(sameChainHook.txHash || crossChainHook.hash) ||
            !!(order?.expiresAt && order.expiresAt < BigInt(Math.floor(Date.now() / 1000)))
          }
        >
          {needsChainSwitch
            ? `Switch to ${getChainConfig(requiredChainForMatch!)?.shortName || 'required chain'}`
            : (sameChainHook.txHash || crossChainHook.hash)
              ? 'Waiting for confirmation...'
              : isPending
                ? 'Confirm in wallet...'
                : isConfirming
                  ? 'Confirming...'
                  : isSuiSameChain
                    ? 'Fill Order'
                    : isSameChain
                    ? 'Execute Order'
                    : isSuiSwap
                      ? 'Create HTLC & Match'
                      : 'Match Order'}
        </Button>
      </div>
    </Modal>
  );
}
