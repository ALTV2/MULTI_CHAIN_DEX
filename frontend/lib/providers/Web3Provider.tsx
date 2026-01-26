'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/contracts/config';
import { useTheme } from './ThemeProvider';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10000,
    },
  },
});

function RainbowKitWithTheme({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <RainbowKitProvider
      theme={
        theme === 'dark'
          ? darkTheme({
              accentColor: '#3b82f6',
              accentColorForeground: 'white',
              borderRadius: 'large',
            })
          : lightTheme({
              accentColor: '#2563eb',
              accentColorForeground: 'white',
              borderRadius: 'large',
            })
      }
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitWithTheme>{children}</RainbowKitWithTheme>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
