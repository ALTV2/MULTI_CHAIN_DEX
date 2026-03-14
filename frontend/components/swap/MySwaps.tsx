'use client';

import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SwapCard } from './SwapCard';
import { useAllUserOrders } from '@/hooks/useAllUserOrders';
import { useTranslation } from '@/hooks/useTranslation';

type FilterView = 'inProgress' | 'open' | 'history';

interface MySwapsProps {
  initialFilter?: FilterView;
}

export function MySwaps({ initialFilter = 'inProgress' }: MySwapsProps = {}) {
  const { isConnected, address } = useAccount(); // EVM wallet
  const suiAccount = useCurrentAccount(); // SUI wallet
  const { activeSwaps, historySwaps, isLoading, refetch } = useAllUserOrders();
  const { t } = useTranslation();
  const [filterView, setFilterView] = useState<FilterView>(initialFilter);

  // Check if either EVM or SUI wallet is connected
  const hasWallet = isConnected || !!suiAccount;
  // Get user address from either wallet (prefer EVM if both connected)
  const userAddress = address || suiAccount?.address;

  // Split activeSwaps into "In Progress" (matched+) and "Open" (order_created)
  // IMPORTANT: Show orders where user is either creator OR matcher
  const inProgressOrders = useMemo(
    () => {
      console.log('[MySwaps inProgress] activeSwaps:', activeSwaps.length, 'EVM address:', address, 'SUI address:', suiAccount?.address);
      return activeSwaps.filter((s) => {
        // Exclude orders still waiting for match
        if (s.phase === 'order_created') return false;

        // Must have connected wallet
        if (!userAddress) return false;

        const lowerAddress = userAddress.toLowerCase();
        const isCreator = s.meta.creator?.toLowerCase() === lowerAddress;
        const isMatcher = s.meta.matcher?.toLowerCase() === lowerAddress;
        const keep = isCreator || isMatcher;

        console.log(`[MySwaps inProgress] Order ${s.meta.orderId}: phase=${s.phase}, role=${s.meta.role}, creator=${s.meta.creator}, matcher=${s.meta.matcher}, keep=${keep}`);
        return keep;
      });
    },
    [activeSwaps, userAddress, suiAccount?.address]
  );

  const openOrders = useMemo(
    () => {
      console.log('[MySwaps open] activeSwaps:', activeSwaps.length, 'EVM address:', address, 'SUI address:', suiAccount?.address);
      return activeSwaps.filter((s) => {
        // Only show orders waiting for match
        if (s.phase !== 'order_created') return false;

        // Only show if user is the creator (matcher doesn't exist yet for open orders)
        if (!userAddress) return false;

        const keep = s.meta.creator?.toLowerCase() === userAddress.toLowerCase();
        console.log(`[MySwaps open] Order ${s.meta.orderId}: phase=${s.phase}, role=${s.meta.role}, creator=${s.meta.creator}, keep=${keep}`);
        return keep;
      });
    },
    [activeSwaps, userAddress, suiAccount?.address]
  );

  if (!hasWallet) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-400">{t('orders.connectWalletDesc')}</p>
      </Card>
    );
  }

  if (isLoading && activeSwaps.length === 0 && historySwaps.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const hasAny = activeSwaps.length > 0 || historySwaps.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{t('orders.myOrders')}</h2>
          <div className="flex items-center gap-2 p-1 rounded-lg bg-light-hover dark:bg-dark-hover">
            <button
              onClick={() => setFilterView('inProgress')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                filterView === 'inProgress'
                  ? 'bg-white dark:bg-dark-card text-accent-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('orders.inProgress')}
            </button>
            <button
              onClick={() => setFilterView('open')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                filterView === 'open'
                  ? 'bg-white dark:bg-dark-card text-accent-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('orders.open')}
            </button>
            <button
              onClick={() => setFilterView('history')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                filterView === 'history'
                  ? 'bg-white dark:bg-dark-card text-accent-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('orders.history')}
            </button>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={refetch} loading={isLoading}>
          {t('common.retry').replace('Try Again', 'Refresh')}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {!hasAny ? (
          <motion.div
            key="no-orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 mb-2">{t('orders.noOrders')}</p>
              <p className="text-sm text-gray-500">{t('orders.noOrdersDesc')}</p>
            </Card>
          </motion.div>
        ) : filterView === 'inProgress' ? (
          <motion.div
            key="inProgress-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* In Progress Orders */}
            {inProgressOrders.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-400">No orders in progress</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {inProgressOrders.map((swap) => (
                  <SwapCard
                    key={`inProgress-${swap.meta.orderId}-${swap.meta.sourceChainId}-${swap.phase}`}
                    swap={swap}
                    onUpdate={refetch}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : filterView === 'open' ? (
          <motion.div
            key="open-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Open Orders */}
            {openOrders.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-400">No open orders</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {openOrders.map((swap) => (
                  <SwapCard
                    key={`open-${swap.meta.orderId}-${swap.meta.sourceChainId}-${swap.phase}`}
                    swap={swap}
                    onUpdate={refetch}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* History */}
            {historySwaps.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-400">{t('orders.noOrdersDesc')}</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {historySwaps.map((swap) => (
                  <SwapCard
                    key={`history-${swap.meta.orderId}-${swap.meta.sourceChainId}-${swap.phase}`}
                    swap={swap}
                    onUpdate={refetch}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
