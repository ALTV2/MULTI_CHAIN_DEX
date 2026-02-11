'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TargetWalletSelector } from '@/components/swap/TargetWalletSelector';
import { useMatchCrossChainOrder, type CrossChainOrder } from '@/hooks/useCrossChainOrders';
import { getChainConfig } from '@/lib/contracts/addresses';
import { getTokenByAddress } from '@/lib/constants/tokens';
import { saveSwap } from '@/lib/utils/swapStorage';
import { formatUnits } from 'viem';
import { toast } from 'sonner';
import { ZERO_BYTES32 } from '@/lib/constants/swap';

interface MatchOrderModalProps {
  open: boolean;
  onClose: () => void;
  order: CrossChainOrder | null;
  sourceChainId: number;
}

export function MatchOrderModal({ open, onClose, order, sourceChainId }: MatchOrderModalProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [targetWallet, setTargetWallet] = useState('');

  const targetChainId = order ? Number(order.targetChainId) : 0;
  const { matchOrder, isPending, isConfirming, isSuccess, error } = useMatchCrossChainOrder(sourceChainId);

  const sourceConfig = getChainConfig(sourceChainId);
  const targetConfig = getChainConfig(targetChainId);

  useEffect(() => {
    if (address) setTargetWallet(address);
  }, [address]);

  useEffect(() => {
    if (isSuccess && order && address) {
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
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const sellToken = getTokenByAddress(sourceChainId, order.sellToken);
  const buyToken = getTokenByAddress(targetChainId, order.buyToken);
  const needsChainSwitch = currentChainId !== sourceChainId;

  async function handleMatch() {
    if (!order || !address) return;

    if (needsChainSwitch) {
      switchChain({ chainId: sourceChainId });
      return;
    }

    // Placeholder — real htlcSwapId is set when the HTLC is created on-chain
    matchOrder(order.id, ZERO_BYTES32 as `0x${string}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Match Order" className="max-w-lg">
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
            {sellToken ? formatUnits(order.sellAmount, sellToken.decimals) : '—'}{' '}
            <span className="text-lg text-gray-400">{sellToken?.symbol}</span>
          </div>

          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">You send</span>
            <Badge variant="success" style={{ color: targetConfig?.color }}>
              {targetConfig?.shortName}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {buyToken ? formatUnits(order.buyAmount, buyToken.decimals) : '—'}{' '}
            <span className="text-lg text-gray-400">{buyToken?.symbol}</span>
          </div>
        </div>

        {/* Target wallet */}
        <TargetWalletSelector
          targetChainId={sourceChainId}
          value={targetWallet}
          onChange={setTargetWallet}
        />

        {error && (
          <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl">
            <p className="text-sm text-accent-red">{error.message}</p>
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          onClick={handleMatch}
          loading={isPending || isConfirming}
          disabled={!address || !targetWallet}
        >
          {needsChainSwitch
            ? `Switch to ${sourceConfig?.shortName}`
            : isPending
              ? 'Confirm in wallet...'
              : isConfirming
                ? 'Confirming...'
                : 'Match Order'}
        </Button>
      </div>
    </Modal>
  );
}
