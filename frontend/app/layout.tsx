import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@mysten/dapp-kit/dist/index.css';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';
import { Web3Provider } from '@/lib/providers/Web3Provider';
import { SuiWalletProvider } from '@/lib/providers/SuiWalletProvider';
import { Header } from '@/components/layout/Header';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Multi-Chain DEX',
  description: 'Decentralized Exchange with Order Book',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <Web3Provider>
            <SuiWalletProvider>
              <VersionBadge />
              <div className="min-h-screen flex flex-col bg-mesh">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
              </div>
              <Toaster
                position="bottom-right"
                expand={false}
                richColors
                closeButton
              />
            </SuiWalletProvider>
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
