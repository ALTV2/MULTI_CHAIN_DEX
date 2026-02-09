'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAccount, useChainId, useBalance, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId, contractAddresses } from '@/lib/contracts/addresses';
import { useCreateCrossChainOrder, useMyeCrossChainOrders } from '@/hooks/useCrossChainOrders';
import { saveSwap } from '@/lib/utils/swapStorage';
import { generateSecret, generateHashlock } from '@/hooks/useHTLC';
import type { StoredSwapMeta } from '@/types/swap';

type TokenOption = {
  address: `0x${string}`;
  symbol: string;
};

function getTokenOptions(chainId: number): TokenOption[] {
  const addresses = contractAddresses[chainId as SupportedChainId];
  if (!addresses) return [];

  const config = chainConfig[chainId as SupportedChainId];
  const options: TokenOption[] = [
    { address: '0x0000000000000000000000000000000000000000', symbol: config?.nativeCurrency.symbol || 'ETH' },
  ];

  const isAmoy = chainId === 80002;
  if (addresses.testTokenA) {
    options.push({ address: addresses.testTokenA as `0x${string}`, symbol: isAmoy ? 'pTka' : 'TKA' });
  }
  if (addresses.testTokenB) {
    options.push({ address: addresses.testTokenB as `0x${string}`, symbol: isAmoy ? 'pTkb' : 'TKB' });
  }

  return options;
}

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function CrossChainSwapForm() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });

  // Sell token state is declared below, but we need a ref for the ERC20 balance hook
  const [sellToken, setSellToken] = useState<`0x${string}`>('0x0000000000000000000000000000000000000000');
  const isNativeSell = sellToken === '0x0000000000000000000000000000000000000000';

  const { data: erc20Balance } = useReadContract({
    address: isNativeSell ? undefined : sellToken,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !isNativeSell && !!address },
  });

  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [buyToken, setBuyToken] = useState<`0x${string}`>('0x0000000000000000000000000000000000000000');
  const [targetChainId, setTargetChainId] = useState<number>(
    supportedChains.find((c) => c.id !== chainId)?.id || supportedChains[0].id
  );
  const [expiryHours, setExpiryHours] = useState('48');

  const { createOrder, isPending, isConfirming, isSuccess, error } = useCreateCrossChainOrder(chainId);
  const { orders: myOrders, refetch: refetchMyOrders } = useMyeCrossChainOrders(chainId);

  const sourceChainConfig = chainConfig[chainId as SupportedChainId];
  const targetChainConfig = chainConfig[targetChainId as SupportedChainId];

  const otherChains = useMemo(
    () => supportedChains.filter((c) => c.id !== chainId),
    [chainId]
  );

  const sourceTokenOptions = useMemo(() => getTokenOptions(chainId), [chainId]);
  const targetTokenOptions = useMemo(() => getTokenOptions(targetChainId), [targetChainId]);

  // Reset buy token when target chain changes
  useEffect(() => {
    setBuyToken('0x0000000000000000000000000000000000000000');
  }, [targetChainId]);

  // Track pending order data for saving after success
  const pendingOrderRef = useRef<{
    sellToken: string;
    sellAmount: string;
    buyToken: string;
    buyAmount: string;
    targetChainId: number;
    secret: string;
    hashlock: string;
  } | null>(null);

  // Refetch orders on success and save to localStorage
  useEffect(() => {
    if (isSuccess && address && pendingOrderRef.current) {
      const pending = pendingOrderRef.current;
      pendingOrderRef.current = null;

      // Fetch the latest orders to get the newly created order ID
      refetchMyOrders().then(({ data }) => {
        if (data && Array.isArray(data) && data.length > 0) {
          // The latest order should be the one we just created
          const latestOrder = data[data.length - 1] as any;
          const orderId = latestOrder.id?.toString() || `${Date.now()}`;

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
        }
      });
    }
  }, [isSuccess, address, chainId, refetchMyOrders]);

  const handleCreateOrder = async () => {
    if (!address || !sellAmount || !buyAmount) return;

    try {
      // Generate secret and hashlock for future HTLC creation
      const secret = generateSecret();
      const hashlock = generateHashlock(secret);

      // Save pending order data before tx
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
      const minTimelock = BigInt(3600); // 1 hour minimum timelock for HTLC

      await createOrder({
        sellToken,
        sellAmount: parseEther(sellAmount),
        buyToken,
        buyAmount: parseEther(buyAmount),
        targetChainId,
        targetAddress: address, // receive on same address on target chain
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

  const selectedSellSymbol = sourceTokenOptions.find(t => t.address === sellToken)?.symbol || 'Token';
  const selectedBuySymbol = targetTokenOptions.find(t => t.address === buyToken)?.symbol || 'Token';

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-6">Create Cross-Chain Order</h2>

      <div className="space-y-6">
        {/* Source Chain - Sell */}
        <div className="p-4 rounded-lg bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Sell on</span>
            <span
              className="text-sm font-medium px-2 py-1 rounded"
              style={{ backgroundColor: `${sourceChainConfig?.color}20`, color: sourceChainConfig?.color }}
            >
              {sourceChainConfig?.name}
            </span>
          </div>
          <div className="flex gap-3 items-center">
            <Input
              type="number"
              placeholder="0.0"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="text-2xl bg-transparent border-none p-0 flex-1"
            />
            <select
              value={sellToken}
              onChange={(e) => setSellToken(e.target.value as `0x${string}`)}
              className="px-3 py-2 rounded-lg bg-gray-700 border-none text-sm font-medium"
            >
              {sourceTokenOptions.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            Balance:{' '}
            {isNativeSell
              ? `${balance ? Number(balance.formatted).toFixed(6) : '0'} ${sourceChainConfig?.nativeCurrency.symbol}`
              : `${erc20Balance !== undefined ? Number(formatEther(erc20Balance as bigint)).toFixed(6) : '...'} ${sourceTokenOptions.find(t => t.address === sellToken)?.symbol || 'Token'}`}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Target Chain - Buy */}
        <div className="p-4 rounded-lg bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Buy on</span>
            <select
              value={targetChainId}
              onChange={(e) => setTargetChainId(Number(e.target.value))}
              className="text-sm font-medium px-2 py-1 rounded bg-gray-700 border-none"
              style={{ color: targetChainConfig?.color }}
            >
              {otherChains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chainConfig[chain.id as SupportedChainId]?.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 items-center">
            <Input
              type="number"
              placeholder="0.0"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="text-2xl bg-transparent border-none p-0 flex-1"
            />
            <select
              value={buyToken}
              onChange={(e) => setBuyToken(e.target.value as `0x${string}`)}
              className="px-3 py-2 rounded-lg bg-gray-700 border-none text-sm font-medium"
            >
              {targetTokenOptions.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Order Expiry */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Order Expiry
          </label>
          <select
            value={expiryHours}
            onChange={(e) => setExpiryHours(e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700"
          >
            <option value="24">24 hours</option>
            <option value="48">48 hours (Recommended)</option>
            <option value="72">72 hours</option>
            <option value="168">7 days</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Order will be available for matching until expiry. No tokens are locked at this stage.
          </p>
        </div>

        {/* Summary */}
        {sellAmount && buyAmount && parseFloat(sellAmount) > 0 && parseFloat(buyAmount) > 0 && (
          <div className="p-3 rounded-lg bg-gray-800/30 text-sm text-gray-300">
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
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
            {error.message}
          </div>
        )}

        {/* Success */}
        {isSuccess && (
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400 text-sm">
            Order created successfully! It is now visible to counterparties on the other chain.
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="w-full"
          size="lg"
          disabled={!isFormValid || isPending || isConfirming}
          onClick={handleCreateOrder}
        >
          {isPending || isConfirming ? 'Creating Order...' : 'Create Order'}
        </Button>
      </div>
    </Card>
  );
}
