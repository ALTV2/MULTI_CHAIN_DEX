'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId, useBalance, useReadContract, useSwitchChain } from 'wagmi';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { parseEther, formatEther, zeroAddress, parseUnits } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { TokenIcon } from '@/components/common/TokenIcon';
import { Badge } from '@/components/ui/Badge';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId, getContractAddress, getSupportedChainIds } from '@/lib/contracts/addresses';
import { getTokensByChainId, getTokenByAddress } from '@/lib/constants/tokens';
import { useCreateCrossChainOrder } from '@/hooks/useCrossChainOrders';
import { useCreateOrder } from '@/hooks/useCreateOrder';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useCreateSuiOrder } from '@/hooks/useSuiOrders';
import { useCreateSuiSameChainOrder } from '@/hooks/useSuiSameChainOrders';
import { TargetWalletSelector } from '@/components/swap/TargetWalletSelector';
import { useTranslation } from '@/hooks/useTranslation';
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

interface UnifiedCreateOrderFormProps {
  onOrderCreated?: () => void;
}

export function UnifiedCreateOrderForm({ onOrderCreated }: UnifiedCreateOrderFormProps = {}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const suiAccount = useCurrentAccount();
  const { t } = useTranslation();

  // Chain and token selection
  const [sourceChainId, setSourceChainId] = useState<number | string>(chainId);
  const [targetChainId, setTargetChainId] = useState<number | string>(
    supportedChains.find((c) => c.id !== chainId)?.id || polygonAmoy.id
  );
  const [sellToken, setSellToken] = useState<string>(zeroAddress);
  const [buyToken, setBuyToken] = useState<string>(zeroAddress);

  // Amounts
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [expiryHours, setExpiryHours] = useState('48');
  const [targetAddress, setTargetAddress] = useState(address || '');

  const isCrossChain = sourceChainId !== targetChainId;
  const isSuiSource = typeof sourceChainId === 'string';
  const isSuiTarget = typeof targetChainId === 'string';
  const isSuiOrder = isSuiSource || isSuiTarget;

  // Update source chain when wallet chain changes
  useEffect(() => {
    setSourceChainId(chainId);
  }, [chainId]);

  // Get balances - only for EVM chains
  const isEvmSource = typeof sourceChainId === 'number';
  const { data: nativeBalance } = useBalance({
    address,
    chainId: isEvmSource ? sourceChainId : undefined,
  });
  const isNativeSell = sellToken === zeroAddress;

  const { data: erc20Balance } = useReadContract({
    address: isNativeSell ? undefined : (sellToken as `0x${string}`),
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: isEvmSource ? sourceChainId : undefined,
    query: { enabled: !isNativeSell && !!address && isEvmSource },
  });

  // SUI balance
  const suiClient = useSuiClient();
  const [suiBalance, setSuiBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuiSource || !suiAccount) {
      setSuiBalance(null);
      return;
    }

    let isMounted = true;

    const fetchSuiBalance = async () => {
      try {
        const balanceData = await suiClient.getBalance({
          owner: suiAccount.address,
          coinType: sellToken === zeroAddress ? '0x2::sui::SUI' : sellToken,
        });

        if (isMounted) {
          // SUI has 9 decimals by default
          const formatted = (Number(balanceData.totalBalance) / 1e9).toFixed(6);
          setSuiBalance(formatted);
        }
      } catch (error) {
        console.error('Error fetching SUI balance:', error);
        if (isMounted) {
          setSuiBalance('0');
        }
      }
    };

    fetchSuiBalance();

    // Poll every 10 seconds
    const interval = setInterval(fetchSuiBalance, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [suiClient, suiAccount, sellToken, isSuiSource]);

  // Chain configs
  const sourceChainConfig = chainConfig[sourceChainId as SupportedChainId];
  const targetChainConfig = chainConfig[targetChainId as SupportedChainId];

  // Token options
  const sourceTokenOptions = useMemo<SelectOption[]>(() => {
    return getTokensByChainId(sourceChainId).map((token) => ({
      value: token.address,
      label: token.symbol,
      description: token.name,
      icon: <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />,
    }));
  }, [sourceChainId]);

  const targetTokenOptions = useMemo<SelectOption[]>(() => {
    return getTokensByChainId(targetChainId).map((token) => ({
      value: token.address,
      label: token.symbol,
      description: token.name,
      icon: <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />,
    }));
  }, [targetChainId]);

  // Chain options
  const chainOptions = useMemo<SelectOption[]>(() => {
    return getSupportedChainIds().map((chainId) => {
      const config = chainConfig[chainId];
      return {
        value: String(chainId),
        label: config?.shortName || `Chain ${chainId}`,
        icon: config?.icon ? <img src={config.icon} alt="" className="w-5 h-5 rounded-full" /> : undefined,
      };
    });
  }, []);

  const expiryOptions: SelectOption[] = [
    { value: '24', label: '24 hours' },
    { value: '48', label: '48 hours (Recommended)' },
    { value: '72', label: '72 hours' },
    { value: '168', label: '7 days' },
  ];

  // Hooks for order creation (EVM)
  const { createOrder: createCrossChainOrder, isPending: isCrossChainPending, isConfirming: isCrossChainConfirming, isSuccess: isCrossChainSuccess } = useCreateCrossChainOrder(typeof sourceChainId === 'number' ? sourceChainId : sepolia.id);
  const { createOrder: createSameChainOrder, isCreating: isSameChainCreating, isSuccess: isSameChainSuccess } = useCreateOrder();

  // Hook for SUI cross-chain order creation (SUI → EVM)
  const { createOrder: createSuiOrder, isPending: isSuiOrderPending } = useCreateSuiOrder();

  // Hook for SUI same-chain order creation (SUI → SUI)
  const { createOrder: createSuiSameChainOrder, isPending: isSuiSameChainOrderPending } = useCreateSuiSameChainOrder();

  // Reset tokens when chains change
  useEffect(() => {
    setSellToken(zeroAddress);
  }, [sourceChainId]);

  useEffect(() => {
    setBuyToken(zeroAddress);
  }, [targetChainId]);

  // Handle cross-chain order success
  useEffect(() => {
    let toastId: string | number | undefined;

    if (isCrossChainPending) {
      toastId = toast.loading('Submitting transaction...');
    } else if (isCrossChainConfirming) {
      if (toastId) toast.dismiss(toastId);
      toastId = toast.loading('Waiting for confirmation...');
    } else if (isCrossChainSuccess) {
      if (toastId) toast.dismiss(toastId);
      toast.success('Cross-chain order created successfully!');
      setSellAmount('');
      setBuyAmount('');
      if (onOrderCreated) {
        setTimeout(onOrderCreated, 100);
      }
    }

    return () => {
      if (toastId) toast.dismiss(toastId);
    };
  }, [isCrossChainPending, isCrossChainConfirming, isCrossChainSuccess, onOrderCreated]);

  // Handle same-chain order success
  useEffect(() => {
    if (isSameChainSuccess) {
      toast.success('Order created successfully!');
      setSellAmount('');
      setBuyAmount('');
      if (onOrderCreated) {
        setTimeout(onOrderCreated, 100);
      }
    }
  }, [isSameChainSuccess, onOrderCreated]);

  // Approval for same-chain orders (EVM only)
  const orderBookAddress = isEvmSource
    ? (getContractAddress(sourceChainId, 'orderBook') as `0x${string}`)
    : undefined;
  const sellTokenData = sourceTokenOptions.find((t) => t.value === sellToken);
  const buyTokenData = targetTokenOptions.find((t) => t.value === buyToken);

  const parsedSellAmount = sellTokenData && sellAmount && !isNativeSell
    ? parseUnits(sellAmount, 18) // Assuming 18 decimals
    : 0n;

  const { needsApproval, approve, isApproving, isApproved } = useTokenApproval(
    !isCrossChain && !isNativeSell && isEvmSource ? (sellToken as `0x${string}`) : undefined,
    (orderBookAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    parsedSellAmount
  );

  const handleSwitchChains = () => {
    const tmp = sourceChainId;
    setSourceChainId(targetChainId);
    setTargetChainId(tmp);
    const tmpToken = sellToken;
    setSellToken(buyToken);
    setBuyToken(tmpToken);
  };

  const handleCreateOrder = async () => {
    if (!userAddress || !sellAmount || !buyAmount) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      // SUI Order Creation
      if (isSuiOrder) {
        if (!suiAccount) {
          toast.error('Please connect your SUI wallet');
          return;
        }

        // SUI same-chain orders — route to order_book.move (pair created on-demand)
        if (isSuiSource && isSuiTarget) {
          const SUI_DECIMALS = 9;
          const parsedSell = BigInt(Math.round(parseFloat(sellAmount) * Math.pow(10, SUI_DECIMALS)));
          const parsedBuy = BigInt(Math.round(parseFloat(buyAmount) * Math.pow(10, SUI_DECIMALS)));
          await createSuiSameChainOrder({
            coinAType: sellToken,
            coinBType: buyToken,
            sellAmount: parsedSell,
            buyAmount: parsedBuy,
          });
          setSellAmount('');
          setBuyAmount('');
          if (onOrderCreated) setTimeout(onOrderCreated, 100);
          return;
        }

        // EVM→SUI: order must be created from the SUI side
        if (!isSuiSource && isSuiTarget) {
          toast.error('To swap EVM→SUI, please select SUI as the source chain');
          return;
        }

        // At this point: SUI→EVM only (isSuiSource=true, isSuiTarget=false)
        const targetChain = typeof targetChainId === 'number' ? targetChainId : null;
        if (targetChain === null) {
          toast.error('Invalid target chain for SUI order');
          return;
        }

        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryHours || '48') * 3600);

        // CRITICAL: SUI Move uses u64 for amounts (max: ~18.4 quintillion)
        // With 18 decimals, this limits us to ~18 tokens max - NOT PRACTICAL!
        // WORKAROUND: Normalize all cross-chain amounts to 9 decimals (SUI standard)
        // This allows storing up to ~18 billion tokens per order

        const sellTokenInfo = getTokenByAddress(sourceChainId, sellToken);
        const buyTokenInfo = getTokenByAddress(targetChainId, buyToken);

        // For cross-chain orders, always use 9 decimals to avoid u64 overflow
        const CROSS_CHAIN_DECIMALS = 9;

        console.log('💰 Token info:', {
          sell: { token: sellToken, symbol: sellTokenInfo?.symbol, nativeDecimals: sellTokenInfo?.decimals },
          buy: { token: buyToken, symbol: buyTokenInfo?.symbol, nativeDecimals: buyTokenInfo?.decimals },
          storedDecimals: CROSS_CHAIN_DECIMALS,
          note: 'Using 9 decimals to avoid u64 overflow in Move contract'
        });

        // Convert amounts to 9 decimals
        const parsedSellAmount = parseUnits(sellAmount, CROSS_CHAIN_DECIMALS);
        const parsedBuyAmount = parseUnits(buyAmount, CROSS_CHAIN_DECIMALS);
        const minTimelock = BigInt(3600); // 1 hour minimum

        await createSuiOrder({
          sellToken,
          sellAmount: parsedSellAmount,
          buyToken,
          buyAmount: parsedBuyAmount,
          targetChainId: targetChain,
          targetAddress: targetAddress || suiAccount.address,
          minTimelock,
          expiresAt,
        });

        toast.success('SUI order created successfully!');
        setSellAmount('');
        setBuyAmount('');
        if (onOrderCreated) {
          setTimeout(onOrderCreated, 100);
        }
        return;
      }

      // EVM Order Creation
      // Type guard: sourceChainId must be number for EVM chains
      if (typeof sourceChainId !== 'number') {
        toast.error('Invalid source chain for EVM order');
        return;
      }

      if (sourceChainId !== chainId) {
        toast.error(`Please switch to ${sourceChainConfig?.name} network first`);
        switchChain?.({ chainId: sourceChainId });
        return;
      }

      if (isCrossChain) {
        // Cross-chain order
        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryHours) * 3600);
        const minTimelock = BigInt(3600);

        await createCrossChainOrder({
          sellToken: sellToken as `0x${string}`,
          sellAmount: parseEther(sellAmount),
          buyToken: buyToken as `0x${string}`,
          buyAmount: parseEther(buyAmount),
          targetChainId: targetChainId as number,
          targetAddress: (targetAddress || address) as `0x${string}`,
          minTimelock,
          expiresAt,
        });

        // Success toast and tab switch handled in useEffect
      } else {
        // Same-chain order
        if (needsApproval && !isApproved) {
          toast.info('Approving token...');
          await approve();
          toast.success('Token approved!');
        }

        await createSameChainOrder({
          tokenToSell: sellToken as `0x${string}`,
          tokenToBuy: buyToken as `0x${string}`,
          sellAmount,
          buyAmount,
          sellDecimals: 18,
          buyDecimals: 18,
        });

        // Success toast and tab switch handled in useEffect
      }
    } catch (err: any) {
      console.error('Failed to create order:', err);
      toast.error(err.message || 'Failed to create order');
    }
  };

  const selectedSellSymbol = sourceTokenOptions.find((o) => o.value === sellToken)?.label || 'Token';
  const selectedBuySymbol = targetTokenOptions.find((o) => o.value === buyToken)?.label || 'Token';

  const rate = sellAmount && buyAmount && parseFloat(sellAmount) > 0
    ? parseFloat(buyAmount) / parseFloat(sellAmount)
    : 0;

  // Validation: same token not allowed in same-chain
  const sameTokenError = !isCrossChain && sellToken === buyToken && sellToken !== zeroAddress;

  // Check wallet connection based on chain type
  const walletConnected = isSuiOrder ? !!suiAccount : isConnected;
  const userAddress = isSuiOrder ? suiAccount?.address : address;

  const isFormValid = sellAmount && buyAmount && parseFloat(sellAmount) > 0 && parseFloat(buyAmount) > 0 && !sameTokenError && walletConnected;
  const isPending = isCrossChainPending || isSameChainCreating || isApproving || isSuiOrderPending || isSuiSameChainOrderPending;
  const isProcessing = isCrossChainPending || isCrossChainConfirming || isSameChainCreating || isApproving || isSuiOrderPending || isSuiSameChainOrderPending;

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('orders.createOrder')}
          </h2>
          <Badge variant={isCrossChain ? 'info' : 'warning'}>
            {isCrossChain ? t('orders.crossChain') : t('orders.sameChain')}
          </Badge>
        </div>

        {/* Source Chain - Sell */}
        <div className="p-4 rounded-xl bg-light-hover/50 dark:bg-dark-hover/50 border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('swapForm.sellOn')}
            </span>
            <Select
              value={String(sourceChainId)}
              onChange={(v) => {
                // Check if value is numeric or string chainId
                const chainId = v.includes(':') ? v : Number(v);
                setSourceChainId(chainId);
              }}
              options={chainOptions}
              className="w-48"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-3">
            <Select
              value={sellToken}
              onChange={setSellToken}
              options={sourceTokenOptions}
              label={t('chainPair.token')}
              searchable
              allowCustom
              disabled={isProcessing}
            />
            <Input
              type="number"
              placeholder="0.0"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="text-2xl"
              disabled={isProcessing}
            />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('swapForm.balance')}:{' '}
              {isSuiSource
                ? `${suiBalance || '...'} ${selectedSellSymbol}`
                : isNativeSell
                ? `${nativeBalance ? Number(nativeBalance.formatted).toFixed(6) : '0'} ${sourceChainConfig?.nativeCurrency.symbol}`
                : `${erc20Balance !== undefined ? Number(formatEther(erc20Balance as bigint)).toFixed(6) : '...'} ${selectedSellSymbol}`}
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwitchChains}
            disabled={isProcessing}
            className="w-10 h-10 rounded-full bg-light-hover dark:bg-dark-hover border border-light-border dark:border-dark-border hover:bg-accent-blue/10 hover:border-accent-blue/20 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-accent-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Target Chain - Buy */}
        <div className="p-4 rounded-xl bg-light-hover/50 dark:bg-dark-hover/50 border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('swapForm.buyOn')}
            </span>
            <Select
              value={String(targetChainId)}
              onChange={(v) => {
                // Check if value is numeric or string chainId
                const chainId = v.includes(':') ? v : Number(v);
                setTargetChainId(chainId);
              }}
              options={chainOptions}
              className="w-48"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-3">
            <Select
              value={buyToken}
              onChange={setBuyToken}
              options={targetTokenOptions}
              label={t('chainPair.token')}
              searchable
              allowCustom
              disabled={isProcessing}
            />
            <Input
              type="number"
              placeholder="0.0"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="text-2xl"
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Cross-chain options */}
        {isCrossChain && (
          <>
            <div>
              <TargetWalletSelector
                targetChainId={targetChainId}
                value={targetAddress}
                onChange={setTargetAddress}
              />
              <p className="text-xs text-gray-500 mt-1">{t('swapForm.receiveOnDesc')}</p>
            </div>

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
          </>
        )}

        {/* Error: Same token */}
        {sameTokenError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            Cannot swap the same token. Please select different tokens.
          </div>
        )}

        {/* Info: SUI wallet required */}
        {isSuiOrder && !suiAccount && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
            ℹ️ Please connect your SUI wallet to create orders on SUI network.
          </div>
        )}

        {/* Rate Summary */}
        {rate > 0 && !sameTokenError && (
          <div className="p-3 rounded-xl bg-light-hover/30 dark:bg-dark-hover/30 border border-light-border dark:border-dark-border">
            <div className="text-sm space-y-1">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Exchange Rate:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  1 {selectedSellSymbol} = {rate.toFixed(6)} {selectedBuySymbol}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Inverse Rate:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  1 {selectedBuySymbol} = {(1 / rate).toFixed(6)} {selectedSellSymbol}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!walletConnected ? (
          <Button type="button" size="lg" className="w-full" disabled>
            Connect {isSuiOrder ? 'SUI' : 'EVM'} Wallet
          </Button>
        ) : !isCrossChain && !isSuiOrder && needsApproval && !isApproved ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => approve()}
            loading={isApproving}
            disabled={!isFormValid || isApproving}
          >
            Approve {selectedSellSymbol}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleCreateOrder}
            loading={isPending}
            disabled={!isFormValid || isPending}
          >
            {isPending ? t('swapForm.creating') : t('swapForm.create')}
          </Button>
        )}
      </div>
    </Card>
  );
}
