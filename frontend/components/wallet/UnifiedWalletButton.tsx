'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ConnectButton as SuiConnectButton } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

type WalletType = 'evm' | 'sui' | null;

export function UnifiedWalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<WalletType>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { disconnect: disconnectEvm } = useDisconnect();
  const suiAccount = useCurrentAccount();
  const { mutate: disconnectSui } = useDisconnectWallet();

  const isAnyConnected = isEvmConnected || !!suiAccount;

  // Auto-click the connect button when selectedType changes
  useEffect(() => {
    if (selectedType && buttonRef.current) {
      // Wait for the button to render, then click it
      const timer = setTimeout(() => {
        const button = buttonRef.current?.querySelector('button');
        if (button) {
          button.click();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedType]);

  // If a wallet type modal is open, show the respective connect button
  if (selectedType === 'evm') {
    return (
      <div ref={buttonRef} className="relative">
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
        <button
          onClick={() => {
            setSelectedType(null);
            setIsOpen(true);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center text-xs"
          title="Close"
        >
          ×
        </button>
      </div>
    );
  }

  if (selectedType === 'sui') {
    return (
      <div ref={buttonRef} className="relative">
        <SuiConnectButton />
        <button
          onClick={() => {
            setSelectedType(null);
            setIsOpen(true);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center text-xs"
          title="Close"
        >
          ×
        </button>
      </div>
    );
  }

  // If wallets are connected, show status
  if (isAnyConnected) {
    return (
      <div className="flex items-center gap-2">
        {/* EVM Wallet */}
        {isEvmConnected && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-light-hover dark:bg-dark-hover rounded-lg border border-light-border dark:border-dark-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">EVM</span>
            </div>
            <button
              onClick={() => disconnectEvm()}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Disconnect EVM"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* SUI Wallet */}
        {suiAccount && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-light-hover dark:bg-dark-hover rounded-lg border border-light-border dark:border-dark-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {suiAccount.address.slice(0, 6)}...{suiAccount.address.slice(-4)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">SUI</span>
            </div>
            <button
              onClick={() => disconnectSui()}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Disconnect SUI"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Add wallet button */}
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 text-sm font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
          title="Add another wallet"
        >
          +
        </button>
      </div>
    );
  }

  // Default: Show wallet type selector
  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="primary"
        size="md"
      >
        Connect Wallet
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-[9999] w-80 bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border shadow-2xl animate-fade-in">
            <div className="p-3 space-y-2">
              {/* EVM Wallets */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedType('evm');
                }}
                className={cn(
                  'w-full p-4 rounded-lg border transition-all',
                  'hover:border-accent-blue hover:bg-accent-blue/5',
                  'border-light-border dark:border-dark-border',
                  'bg-light-bg dark:bg-dark-bg'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      EVM Wallets
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      MetaMask, WalletConnect
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* SUI Wallets */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedType('sui');
                }}
                className={cn(
                  'w-full p-4 rounded-lg border transition-all',
                  'hover:border-accent-blue hover:bg-accent-blue/5',
                  'border-light-border dark:border-dark-border',
                  'bg-light-bg dark:bg-dark-bg'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <img src="/chains/sui.svg" alt="SUI" className="w-7 h-7" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      SUI Wallets
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Sui Wallet, Suiet, Ethos
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-light-border dark:border-dark-border bg-light-hover dark:bg-dark-hover rounded-b-xl">
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Connect both wallets simultaneously
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
