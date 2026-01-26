'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TokenSelector } from './TokenSelector';
import { useCreateOrder } from '@/hooks/useCreateOrder';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { getContractAddress } from '@/lib/contracts/addresses';
import { formatTokenAmount } from '@/lib/utils/formatters';
import { isNativeToken } from '@/lib/constants/tokens';
import { toast } from 'sonner';
import type { Token } from '@/types/token';

export function CreateOrderForm() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [sellToken, setSellToken] = useState<Token | undefined>();
  const [buyToken, setBuyToken] = useState<Token | undefined>();
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');

  const orderBookAddress = getContractAddress(chainId, 'orderBook');

  // Get balance for sell token
  const { balance: sellBalance, formattedBalance: formattedSellBalance } =
    useTokenBalance(sellToken?.address, sellToken?.decimals);

  // Get approval for sell token (if ERC20)
  const parsedSellAmount =
    sellToken && sellAmount
      ? parseUnits(sellAmount, sellToken.decimals)
      : 0n;

  const {
    needsApproval,
    approve,
    isApproving,
    isApproved,
    isCheckingAllowance,
  } = useTokenApproval(
    sellToken?.address,
    orderBookAddress,
    parsedSellAmount
  );

  // Create order mutation
  const { createOrder, isCreating, isSuccess, error, reset } =
    useCreateOrder();

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      toast.success('Order created successfully!');
      setSellAmount('');
      setBuyAmount('');
      reset();
    }
  }, [isSuccess, reset]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sellToken || !buyToken) {
      toast.error('Please select both tokens');
      return;
    }

    if (!sellAmount || !buyAmount) {
      toast.error('Please enter amounts');
      return;
    }

    if (parseFloat(sellAmount) <= 0 || parseFloat(buyAmount) <= 0) {
      toast.error('Amounts must be greater than 0');
      return;
    }

    // Check balance
    const sellAmountBigInt = parseUnits(sellAmount, sellToken.decimals);
    if (sellAmountBigInt > sellBalance) {
      toast.error('Insufficient balance');
      return;
    }

    try {
      // If needs approval, approve first
      if (needsApproval) {
        toast.info('Approving token...');
        await approve();
        toast.success('Token approved!');
      }

      // Create order
      toast.info('Creating order...');
      await createOrder({
        tokenToSell: sellToken.address,
        tokenToBuy: buyToken.address,
        sellAmount,
        buyAmount,
        sellDecimals: sellToken.decimals,
        buyDecimals: buyToken.decimals,
      });
    } catch (err: any) {
      console.error('Error creating order:', err);
    }
  };

  const handleSellAmountChange = (value: string) => {
    setSellAmount(value);
    // Auto-calculate buy amount based on rate if both tokens selected
    // This is optional - you can remove this if you want users to set both amounts manually
  };

  const handleBuyAmountChange = (value: string) => {
    setBuyAmount(value);
  };

  const handleMaxSellAmount = () => {
    if (sellToken) {
      setSellAmount(formattedSellBalance);
    }
  };

  const rate =
    sellAmount && buyAmount && parseFloat(sellAmount) > 0
      ? parseFloat(buyAmount) / parseFloat(sellAmount)
      : 0;

  const isFormValid =
    isConnected &&
    sellToken &&
    buyToken &&
    sellAmount &&
    buyAmount &&
    parseFloat(sellAmount) > 0 &&
    parseFloat(buyAmount) > 0 &&
    parseUnits(sellAmount, sellToken.decimals) <= sellBalance;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <TokenSelector
              label="You Sell"
              selectedToken={sellToken}
              onSelectToken={setSellToken}
              excludeToken={buyToken}
            />
            <Input
              type="text"
              placeholder="0.0"
              value={sellAmount}
              onChange={(e) => handleSellAmountChange(e.target.value)}
              disabled={!sellToken || isCreating}
              rightElement={
                sellToken && (
                  <button
                    type="button"
                    onClick={handleMaxSellAmount}
                    className="text-xs text-accent-blue hover:text-blue-600 font-medium"
                  >
                    MAX
                  </button>
                )
              }
            />
            {sellToken && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Balance:{' '}
                {formatTokenAmount(
                  sellBalance,
                  sellToken.decimals,
                  4
                )}{' '}
                {sellToken.symbol}
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-light-hover dark:bg-dark-hover border border-light-border dark:border-dark-border flex items-center justify-center">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <TokenSelector
              label="You Buy"
              selectedToken={buyToken}
              onSelectToken={setBuyToken}
              excludeToken={sellToken}
            />
            <Input
              type="text"
              placeholder="0.0"
              value={buyAmount}
              onChange={(e) => handleBuyAmountChange(e.target.value)}
              disabled={!buyToken || isCreating}
            />
          </div>

          {rate > 0 && sellToken && buyToken && (
            <div className="p-3 rounded-xl bg-light-hover dark:bg-dark-hover">
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Exchange Rate:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    1 {sellToken.symbol} = {rate.toFixed(6)} {buyToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Inverse Rate:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    1 {buyToken.symbol} = {(1 / rate).toFixed(6)}{' '}
                    {sellToken.symbol}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isConnected ? (
            <Button type="button" size="lg" className="w-full" disabled>
              Connect Wallet
            </Button>
          ) : needsApproval && !isApproved ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => approve()}
              loading={isApproving || isCheckingAllowance}
              disabled={!isFormValid || isApproving}
            >
              Approve {sellToken?.symbol}
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isCreating}
              disabled={!isFormValid || isCreating}
            >
              Create Order
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
