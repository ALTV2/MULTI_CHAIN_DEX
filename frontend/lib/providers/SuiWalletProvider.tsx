'use client';

import { ReactNode } from 'react';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const suiQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchInterval: 10 * 1000,
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  },
  mainnet: {
    url: 'https://fullnode.mainnet.sui.io:443',
  },
});

// SUI always uses testnet (no local SUI node — arm64 incompatible with Docker image)
const defaultNetwork = 'testnet';

interface SuiWalletProviderProps {
  children: ReactNode;
}

export function SuiWalletProvider({ children }: SuiWalletProviderProps) {
  return (
    <QueryClientProvider client={suiQueryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
