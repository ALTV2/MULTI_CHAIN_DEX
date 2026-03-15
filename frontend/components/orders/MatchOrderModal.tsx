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
import { useFillSuiSameChainOrder, SUI_PAIR_CONFIGS } from '@/hooks/useSuiSameChainOrders';
import { useCreateHTLCSwap } from '@/hooks/useHTLC';
import type { UnifiedOrder } from '@/hooks/useAllUnifiedOrdersFixed';
import { getChainConfig, getExplorerTxUrl } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { saveSwap } from '@/lib/utils/swapStorage';
import { generateSecret, generateHashlock, generateSwapId, calculateTimelock } from '@/lib/utils/crossChainCrypto';
import { formatAmount } from '@/lib/utils/formatAmount';
import { toast } from 'sonner';
import { ZERO_BYTES32 } from '@/lib/constants/swap';

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
  const { switchChain } = useSwitchChain();
  const [targetWallet, setTargetWallet] = useState('');
  const [swapSecret, setSwapSecret] = useState<`0x${string}` | null>(null);
  const [pendingSwapData, setPendingSwapData] = useState<any>(null);

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
  const evmHTLCHook = useCreateHTLCSwap(typeof targetChainId === 'number' ? targetChainId : 11155111);

  const sourceConfig = getChainConfig(sourceChainId);
  const targetConfig = getChainConfig(targetChainId);

  // Safety check: if targetConfig is undefined (SUI case), provide defaults
  const safeTargetConfig = targetConfig || { shortName: 'SUI', color: '#4DA2FF', name: 'SUI (Testnet)' };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSwapSecret(null);
      setPendingSwapData(null);
    }
  }, [open]);

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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      toast.success('Order matched successfully!');
      onClose();
    }
  }, [crossChainHook.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle success for same-chain orders
  useEffect(() => {
    if (sameChainHook.isSuccess && order && isSameChain) {
      console.log('✅ Same-chain order executed successfully');
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
      console.log('✅ SUI → EVM HTLC created successfully on EVM');

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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Clear pending data
      setPendingSwapData(null);

      // Close modal after delay to allow user to see and copy secret
      setTimeout(() => {
        onClose();
      }, 3000);
    }
  }, [evmHTLCHook.isSuccess, pendingSwapData]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const sellToken = getTokenByAddress(sourceChainId, order.sellToken);
  const buyToken = getTokenByAddress(targetChainId, order.buyToken); // Buy token is on target chain
  const needsChainSwitch = requiredChainForMatch !== null && currentChainId !== requiredChainForMatch;

  // Validate EVM address format (0x + 40 hex chars)
  const isValidEvmAddress = (addr: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

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

  // Debug logging
  console.log('MatchOrderModal state:', {
    isSameChain,
    isPending,
    isConfirming,
    sameChainSuccess: sameChainHook.isSuccess,
    crossChainSuccess: crossChainHook.isSuccess,
    error,
    txHash: isSameChain ? sameChainHook.txHash : crossChainHook.hash,
  });

  async function handleAction() {
    if (!order) return;

    // Check wallet connection based on chain type (matcher is always on target side!)
    const userAddress = isSuiTarget ? suiAccount?.address : address;
    if (!userAddress) {
      toast.error(`Please connect your ${isSuiTarget ? 'SUI' : 'EVM'} wallet`);
      return;
    }

    if (needsChainSwitch && requiredChainForMatch !== null) {
      switchChain({ chainId: requiredChainForMatch });
      return;
    }

    try {
      if (isSuiSameChain) {
        // SUI same-chain: direct fill via order_book.move
        if (!order.suiSameChainMeta) {
          toast.error('Missing SUI order metadata');
          return;
        }
        const pairConfig = SUI_PAIR_CONFIGS.find(
          (p) => p.pairId === order.suiSameChainMeta!.pairId
        );
        if (!pairConfig) {
          toast.error('Unknown SUI trading pair');
          return;
        }
        await fillSuiSameChainHook.fillOrder({
          orderId: Number(order.id),
          orderObjectId: order.suiSameChainMeta.orderObjectId,
          creator: order.creator,
          sellAmount: order.sellAmount,
          buyAmount: order.buyAmount,
          status: 'Active',
          pairConfig,
        });
        toast.success('Order filled successfully!');
        onClose();
      } else if (isSameChain) {
        // Execute same-chain order
        await sameChainHook.executeOrder({
          orderId: order.id,
          tokenToBuy: order.buyToken,
          buyAmount: order.buyAmount,
        });
      } else if (isSuiSwap) {
        // Cross-chain swap involving SUI - create HTLC
        const secret = generateSecret();
        const hashlock = generateHashlock(secret);
        const timelock = calculateTimelock(true); // First swap gets longer timelock

        if (isSuiSource) {
          // SUI → EVM: Matcher creates HTLC on EVM (target chain) locking EVM tokens
          const swapId = generateSwapId(
            userAddress,
            order.creator,
            hashlock,
            timelock,
            targetChainId // Use target chain (EVM) for swapId generation
          );

          // Store data to be processed after transaction confirms
          setPendingSwapData({
            secret,
            hashlock,
            swapId,
          });

          // Create HTLC directly on EVM (not via order book) using evmHTLCHook
          await evmHTLCHook.createSwap({
            swapId,
            participant: order.targetAddress, // Creator's EVM address from order (where they'll receive tokens)
            hashlock,
            timelock,
            token: order.buyToken, // EVM token that matcher is providing
            amount: order.buyAmount, // Amount of EVM tokens
          });

          // Success handling moved to useEffect above (only after transaction confirms)

          // If SUI wallet connected, also call matchOrder on SUI side
          if (suiAccount) {
            try {
              await suiMatchHook.matchOrder(order.id.toString(), swapId);
              console.log('✅ Order marked as matched on SUI');
            } catch (err) {
              console.warn('Failed to mark order as matched on SUI:', err);
              toast.warning('HTLC created, but could not update order status on SUI. Ask creator to verify HTLC manually.');
            }
          }
        } else if (isSuiTarget) {
          // EVM → SUI: Create HTLC on EVM
          const swapId = generateSwapId(
            userAddress,
            order.creator,
            hashlock,
            timelock,
            sourceChainId
          );

          await crossChainHook.matchOrder(order.id, swapId);

          toast.success('HTLC created! Waiting for counterparty to create their HTLC on SUI.');

          // Save swap data
          if (address) {
            saveSwap(address, {
              orderId: order.id.toString(),
              role: 'matcher',
              sourceChainId: sourceChainId,
              targetChainId: targetChainId, // Use converted targetChainId ('sui:testnet')
              hashlock,
              secret,
              sellToken: order.sellToken,
              sellAmount: order.sellAmount.toString(),
              buyToken: order.buyToken,
              buyAmount: order.buyAmount.toString(),
              creator: order.creator,
              matcher: address,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }
      } else {
        // EVM → EVM: Standard cross-chain match
        await crossChainHook.matchOrder(order.id, ZERO_BYTES32 as `0x${string}`);
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

        {/* Show matcher's SUI receiving address for SUI → EVM swaps */}
        {!isSameChain && isSuiSource && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Your SUI address (where you'll receive {sellToken?.symbol || 'tokens'})
            </label>
            {suiAccount ? (
              <div className="p-3 bg-light-hover dark:bg-dark-hover rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Connected SUI Wallet</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                  {suiAccount.address}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    ⚠️ SUI wallet not connected. Enter your SUI address manually or connect a SUI wallet to receive tokens.
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your SUI address (0x...)"
                    value={targetWallet}
                    onChange={(e) => setTargetWallet(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      targetWallet
                        ? isValidSuiAddress(targetWallet)
                          ? 'border-green-500 dark:border-green-400'
                          : 'border-red-500 dark:border-red-400'
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {targetWallet && !isValidSuiAddress(targetWallet) && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Invalid SUI address format (must start with 0x followed by hex characters)
                    </p>
                  )}
                </div>
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
                  📋 Copy Secret
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

        <Button
          variant="primary"
          className="w-full"
          onClick={handleAction}
          loading={isPending || isConfirming || !!(sameChainHook.txHash || crossChainHook.hash)}
          disabled={
            (isSuiSameChain ? !suiAccount : isSuiTarget ? !suiAccount : !address) ||
            (!isSuiSameChain && !isSameChain && !isTargetWalletValid) ||
            !!(sameChainHook.txHash || crossChainHook.hash)
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
