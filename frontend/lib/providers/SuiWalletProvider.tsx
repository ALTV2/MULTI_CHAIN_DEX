'use client';

/**
 * SUI Wallet Provider
 *
 * Provides SUI wallet connectivity and blockchain client
 * Supports multiple SUI wallets via @mysten/dapp-kit
 */

import { ReactNode } from 'react';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a separate QueryClient for SUI to avoid conflicts with wagmi
const suiQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchInterval: 10 * 1000, // Refetch every 10 seconds
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

// SUI network configuration
const { networkConfig } = createNetworkConfig({
  testnet: {
    url: process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
    network: 'testnet',
  },
  mainnet: {
    url: 'https://fullnode.mainnet.sui.io:443',
    network: 'mainnet',
  },
  devnet: {
    url: 'https://fullnode.devnet.sui.io:443',
    network: 'devnet',
  },
});

interface SuiWalletProviderProps {
  children: ReactNode;
}

/**
 * SUI Wallet Provider Component
 *
 * Wraps the app with SUI wallet connectivity
 * Should be nested inside the main QueryClientProvider
 */
export function SuiWalletProvider({ children }: SuiWalletProviderProps) {
  return (
    <QueryClientProvider client={suiQueryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
