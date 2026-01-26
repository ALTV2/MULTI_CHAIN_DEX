import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';
import { Web3Provider } from '@/lib/providers/Web3Provider';
import { Header } from '@/components/layout/Header';
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
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 container mx-auto px-4 py-8">
                {children}
              </main>
            </div>
            <Toaster
              position="bottom-right"
              expand={false}
              richColors
              closeButton
            />
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
