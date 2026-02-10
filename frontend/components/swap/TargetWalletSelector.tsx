'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useAuth';
import { getWallets, type WalletResponse } from '@/lib/api/wallets';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { chainRegistry } from '@/lib/chains/registry';
import { cn } from '@/lib/utils/cn';

interface TargetWalletSelectorProps {
  targetChainId: number;
  value: string;
  onChange: (address: string) => void;
  className?: string;
}

export function TargetWalletSelector({
  targetChainId,
  value,
  onChange,
  className,
}: TargetWalletSelectorProps) {
  const { address } = useAccount();
  const { isAuthenticated } = useCurrentUser();
  const defaultWallet = useSettingsStore((s) => s.getDefaultTargetWallet(String(targetChainId)));
  const [mode, setMode] = useState<'connected' | 'saved' | 'custom'>('connected');
  const [customAddress, setCustomAddress] = useState('');

  const adapter = chainRegistry.getAdapter(targetChainId);
  const chainInfo = adapter?.getChainInfo();

  const { data: savedWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: getWallets,
    enabled: isAuthenticated,
  });

  const chainWallets = savedWallets?.filter((w) => {
    const chainName = chainInfo?.name.toUpperCase().replace(/\s+/g, '_');
    return w.chain === chainName;
  }) ?? [];

  // Initialize with default or connected wallet
  useEffect(() => {
    if (defaultWallet) {
      onChange(defaultWallet);
      setMode('saved');
    } else if (address) {
      onChange(address);
      setMode('connected');
    }
  }, [defaultWallet, address]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleModeChange(newMode: 'connected' | 'saved' | 'custom') {
    setMode(newMode);
    if (newMode === 'connected' && address) {
      onChange(address);
    } else if (newMode === 'saved' && chainWallets.length > 0) {
      onChange(chainWallets[0].address);
    } else if (newMode === 'custom') {
      onChange(customAddress);
    }
  }

  function handleSavedWalletChange(wallet: WalletResponse) {
    onChange(wallet.address);
  }

  function handleCustomAddressChange(addr: string) {
    setCustomAddress(addr);
    onChange(addr);
  }

  const isValid = !value || !adapter || adapter.isValidAddress(value);

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Receive tokens on
        {chainInfo && (
          <span className="ml-1.5 text-xs font-normal" style={{ color: chainInfo.color }}>
            {chainInfo.shortName}
          </span>
        )}
      </label>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('connected')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            mode === 'connected'
              ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
              : 'bg-light-hover dark:bg-dark-hover text-gray-500 border border-transparent hover:border-light-border dark:hover:border-dark-border'
          )}
        >
          Connected Wallet
        </button>
        {chainWallets.length > 0 && (
          <button
            type="button"
            onClick={() => handleModeChange('saved')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              mode === 'saved'
                ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                : 'bg-light-hover dark:bg-dark-hover text-gray-500 border border-transparent hover:border-light-border dark:hover:border-dark-border'
            )}
          >
            Saved Wallets
          </button>
        )}
        <button
          type="button"
          onClick={() => handleModeChange('custom')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            mode === 'custom'
              ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
              : 'bg-light-hover dark:bg-dark-hover text-gray-500 border border-transparent hover:border-light-border dark:hover:border-dark-border'
          )}
        >
          Custom
        </button>
      </div>

      {/* Address display / input */}
      {mode === 'connected' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-light-hover dark:bg-dark-hover rounded-xl border border-light-border dark:border-dark-border">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex-shrink-0" />
          <span className="text-sm font-mono text-gray-900 dark:text-white truncate">
            {address || 'Not connected'}
          </span>
        </div>
      )}

      {mode === 'saved' && (
        <div className="space-y-2">
          {chainWallets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => handleSavedWalletChange(w)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left',
                w.address.toLowerCase() === value.toLowerCase()
                  ? 'border-accent-blue bg-accent-blue/5'
                  : 'border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover'
              )}
            >
              <div className="w-6 h-6 rounded-full bg-accent-purple/20 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {w.label || 'Wallet'}
                </div>
                <div className="text-xs font-mono text-gray-400 truncate">{w.address}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {mode === 'custom' && (
        <div>
          <input
            type="text"
            value={customAddress}
            onChange={(e) => handleCustomAddressChange(e.target.value)}
            placeholder="Enter wallet address..."
            className={cn(
              'w-full px-4 py-3 rounded-xl',
              'bg-light-hover dark:bg-dark-hover',
              'border',
              !isValid ? 'border-accent-red' : 'border-light-border dark:border-dark-border',
              'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent',
              'font-mono text-sm',
              'transition-all duration-200'
            )}
          />
          {!isValid && customAddress && (
            <p className="mt-1.5 text-xs text-accent-red">Invalid address format</p>
          )}
        </div>
      )}
    </div>
  );
}
