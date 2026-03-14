'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAccount, useChainId, useBalance, useReadContract } from 'wagmi';
import { parseEther, formatEther, zeroAddress } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { TokenIcon } from '@/components/common/TokenIcon';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import { getTokensByChainId } from '@/lib/constants/tokens';
import { useCreateCrossChainOrder, useMyeCrossChainOrders } from '@/hooks/useCrossChainOrders';
import { saveSwap } from '@/lib/utils/swapStorage';
import { generateSecret, generateHashlock } from '@/hooks/useHTLC';
import { TargetWalletSelector } from '@/components/swap/TargetWalletSelector';
import { useTranslation } from '@/hooks/useTranslation';
import type { StoredSwapMeta } from '@/types/swap';
import { toast } from 'sonner';

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface CrossChainSwapFormProps {
  onOrderCreated?: () => void;
}

export function CrossChainSwapForm({ onOrderCreated }: CrossChainSwapFormProps = {}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });
  const { t } = useTranslation();

  const [sellToken, setSellToken] = useState<string>(zeroAddress);
  const isNativeSell = sellToken === zeroAddress;

  const { data: erc20Balance } = useReadContract({
    address: isNativeSell ? undefined : (sellToken as `0x${string}`),
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !isNativeSell && !!address },
  });

  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [buyToken, setBuyToken] = useState<string>(zeroAddress);
  const [targetChainId, setTargetChainId] = useState<number>(
    supportedChains.find((c) => c.id !== chainId)?.id || supportedChains[0].id
  );
  const [targetAddress, setTargetAddress] = useState(address || '');
  const [expiryHours, setExpiryHours] = useState('48');
  const [isResetting, setIsResetting] = useState(false);

  const { createOrder, isPending, isConfirming, isSuccess, error } = useCreateCrossChainOrder(chainId);
  const { orders: myOrders, refetch: refetchMyOrders } = useMyeCrossChainOrders(chainId);

  const sourceChainConfig = chainConfig[chainId as SupportedChainId];
  const targetChainConfig = chainConfig[targetChainId as SupportedChainId];

  const otherChains = useMemo(
    () => supportedChains.filter((c) => c.id !== chainId),
    [chainId]
  );

  const sourceTokenOptions = useMemo<SelectOption[]>(() => {
    return getTokensByChainId(chainId).map((token) => ({
      value: token.address,
      label: token.symbol,
      description: token.name,
      icon: <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />,
    }));
  }, [chainId]);

  const targetTokenOptions = useMemo<SelectOption[]>(() => {
    return getTokensByChainId(targetChainId).map((token) => ({
      value: token.address,
      label: token.symbol,
      description: token.name,
      icon: <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />,
    }));
  }, [targetChainId]);

  const chainOptions = useMemo<SelectOption[]>(() => {
    return otherChains.map((chain) => {
      const config = chainConfig[chain.id as SupportedChainId];
      return {
        value: String(chain.id),
        label: config?.name || `Chain ${chain.id}`,
        icon: (
          <img src={config?.icon || ''} alt="" className="w-5 h-5 flex-shrink-0 rounded-full" />
        ),
      };
    });
  }, [otherChains]);

  const expiryOptions: SelectOption[] = [
    { value: '24', label: '24 hours' },
    { value: '48', label: '48 hours (Recommended)' },
    { value: '72', label: '72 hours' },
    { value: '168', label: '7 days' },
  ];

  useEffect(() => {
    setBuyToken(zeroAddress);
  }, [targetChainId]);

  const pendingOrderRef = useRef<{
    sellToken: string;
    sellAmount: string;
    buyToken: string;
    buyAmount: string;
    targetChainId: number;
    secret: string;
    hashlock: string;
  } | null>(null);

  // Handle transaction status changes with toasts
  useEffect(() => {
    let toastId: string | number | undefined;

    if (isPending) {
      toastId = toast.loading('Submitting transaction...');
    } else if (isConfirming) {
      if (toastId) toast.dismiss(toastId);
      toastId = toast.loading('Waiting for confirmation...');
    } else if (isSuccess && address && pendingOrderRef.current) {
      if (toastId) toast.dismiss(toastId);

      const pending = pendingOrderRef.current;
      pendingOrderRef.current = null;
      setIsResetting(true);

      // Show success toast
      toast.success(
        <div>
          <div className="font-semibold">✅ Order created successfully!</div>
          <div className="text-xs mt-1 opacity-90">
            Your cross-chain order is now available in the order book
          </div>
        </div>,
        { duration: 5000 }
      );

      // Callback to switch to "My Orders" tab
      if (onOrderCreated) {
        setTimeout(onOrderCreated, 100);
      }

      // Save to localStorage in background
      // Wait a bit to ensure blockchain has the order indexed
      setTimeout(() => {
        refetchMyOrders().then(({ data }) => {
          if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn('⚠️ refetchMyOrders returned no data, skipping localStorage save');
            return;
          }

          const latestOrder = data[data.length - 1] as any;

          // ⚠️ CRITICAL: Validate that we have a real order ID (not 0, not undefined)
          if (!latestOrder.id || latestOrder.id === 0n || latestOrder.id === '0') {
            console.error('❌ Invalid order ID, cannot save to localStorage:', latestOrder);
            return;
          }

          const orderId = latestOrder.id.toString();
          console.log('✅ Saving cross-chain order to localStorage:', orderId);

          const swapMeta: StoredSwapMeta = {
            orderId,
            role: 'creator',
            sourceChainId: chainId,
            targetChainId: pending.targetChainId,
            secret: pending.secret,
            hashlock: pending.hashlock,
            sellToken: pending.sellToken,
            sellAmount: pending.sellAmount,
            buyToken: pending.buyToken,
            buyAmount: pending.buyAmount,
            creator: address,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          saveSwap(address, swapMeta);
        }).catch(err => {
          console.error('Failed to save order to localStorage:', err);
        });
      }, 500); // Wait 500ms for blockchain to index the order

      // Reset form immediately to prevent duplicate creation
      setSellAmount('');
      setBuyAmount('');

      // Allow form to be used again after 1 second
      setTimeout(() => {
        setIsResetting(false);
      }, 1000);
    }

    return () => {
      if (toastId) toast.dismiss(toastId);
    };
  }, [isPending, isConfirming, isSuccess, address, chainId, refetchMyOrders, onOrderCreated]);

  const handleCreateOrder = async () => {
    if (!address || !sellAmount || !buyAmount) return;

    try {
      const secret = generateSecret();
      const hashlock = generateHashlock(secret);

      pendingOrderRef.current = {
        sellToken,
        sellAmount: parseEther(sellAmount).toString(),
        buyToken,
        buyAmount: parseEther(buyAmount).toString(),
        targetChainId,
        secret,
        hashlock,
      };

      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryHours) * 3600);
      const minTimelock = BigInt(3600);

      await createOrder({
        sellToken: sellToken as `0x${string}`,
        sellAmount: parseEther(sellAmount),
        buyToken: buyToken as `0x${string}`,
        buyAmount: parseEther(buyAmount),
        targetChainId,
        targetAddress: (targetAddress || address) as `0x${string}`,
        minTimelock,
        expiresAt,
      });
    } catch (err) {
      console.error('Failed to create order:', err);
      pendingOrderRef.current = null;
    }
  };

  const isFormValid =
    sellAmount &&
    parseFloat(sellAmount) > 0 &&
    buyAmount &&
    parseFloat(buyAmount) > 0;

  const isProcessing = isPending || isConfirming || isResetting;

  const selectedSellSymbol = sourceTokenOptions.find((o) => o.value === sellToken)?.label || 'Token';
  const selectedBuySymbol = targetTokenOptions.find((o) => o.value === buyToken)?.label || 'Token';

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-6">{t('swapForm.title')}</h2>

      <div className="space-y-6">
        {/* Source Chain - Sell */}
        <div className="p-4 rounded-xl bg-light-hover/50 dark:bg-dark-hover/50 border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('swapForm.sellOn')}</span>
            <span
              className="text-sm font-medium px-2 py-1 rounded-lg flex items-center gap-1.5"
              style={{ backgroundColor: `${sourceChainConfig?.color}15`, color: sourceChainConfig?.color }}
            >
              {sourceChainConfig?.icon && <img src={sourceChainConfig.icon} alt="" className="w-4 h-4" />}
              {sourceChainConfig?.name}
            </span>
          </div>
          <div className="flex gap-3 items-end">
            <Input
              type="number"
              placeholder="0.0"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="text-2xl bg-transparent border-none p-0 flex-1"
              disabled={isProcessing}
            />
            <div className="w-44">
              <Select
                value={sellToken}
                onChange={setSellToken}
                options={sourceTokenOptions}
                searchable
                allowCustom
                disabled={isProcessing}
              />
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t('swapForm.balance')}:{' '}
            {isNativeSell
              ? `${balance ? Number(balance.formatted).toFixed(6) : '0'} ${sourceChainConfig?.nativeCurrency.symbol}`
              : `${erc20Balance !== undefined ? Number(formatEther(erc20Balance as bigint)).toFixed(6) : '...'} ${selectedSellSymbol}`}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-light-hover dark:bg-dark-hover border border-light-border dark:border-dark-border flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Target Chain - Buy */}
        <div className="p-4 rounded-xl bg-light-hover/50 dark:bg-dark-hover/50 border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('swapForm.buyOn')}</span>
            <div className="w-52">
              <Select
                value={String(targetChainId)}
                onChange={(v) => setTargetChainId(Number(v))}
                options={chainOptions}
                disabled={isProcessing}
              />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <Input
              type="number"
              placeholder="0.0"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="text-2xl bg-transparent border-none p-0 flex-1"
              disabled={isProcessing}
            />
            <div className="w-44">
              <Select
                value={buyToken}
                onChange={setBuyToken}
                options={targetTokenOptions}
                searchable
                allowCustom
                disabled={isProcessing}
              />
            </div>
          </div>
        </div>

        {/* Target Wallet */}
        <div>
          <TargetWalletSelector
            targetChainId={targetChainId}
            value={targetAddress}
            onChange={setTargetAddress}
          />
          <p className="text-xs text-gray-500 mt-1">{t('swapForm.receiveOnDesc')}</p>
        </div>

        {/* Order Expiry */}
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
            {t('swapForm.orderExpiry')}
          </label>
          <Select
            value={expiryHours}
            onChange={setExpiryHours}
            options={expiryOptions}
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 mt-1">{t('swapForm.expiryDesc')}</p>
        </div>

        {/* Summary */}
        {sellAmount && buyAmount && parseFloat(sellAmount) > 0 && parseFloat(buyAmount) > 0 && (
          <div className="p-3 rounded-xl bg-light-hover/30 dark:bg-dark-hover/30 border border-light-border dark:border-dark-border text-sm text-gray-600 dark:text-gray-300">
            <p>
              Sell <strong>{sellAmount} {selectedSellSymbol}</strong> on {sourceChainConfig?.shortName}
              {' '}for <strong>{buyAmount} {selectedBuySymbol}</strong> on {targetChainConfig?.shortName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Rate: 1 {selectedSellSymbol} = {(parseFloat(buyAmount) / parseFloat(sellAmount)).toFixed(6)} {selectedBuySymbol}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">
            {error.message}
          </div>
        )}

        {/* Success */}
        {isSuccess && (
          <div className="p-3 rounded-xl bg-green-500/10 text-green-400 text-sm">
            {t('swapForm.success')}
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="w-full"
          size="lg"
          disabled={!isFormValid || isPending || isConfirming || isResetting}
          loading={isPending || isConfirming || isResetting}
          onClick={handleCreateOrder}
        >
          {isPending || isConfirming ? t('swapForm.creating')
            : isResetting ? 'Resetting...'
            : t('swapForm.create')}
        </Button>
      </div>
    </Card>
  );
}
