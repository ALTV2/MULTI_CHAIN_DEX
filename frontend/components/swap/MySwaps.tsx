'use client';

import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SwapCard } from './SwapCard';
import { useActiveSwaps, useSwapHistory, useRefreshDexData } from '@/hooks/useDexApi';
import { swapDtoToActiveSwap } from '@/lib/api/dexApiMapper';
import { useTranslation } from '@/hooks/useTranslation';

type FilterView = 'inProgress' | 'open' | 'history';

interface MySwapsProps {
  initialFilter?: FilterView;
}

export function MySwaps({ initialFilter = 'inProgress' }: MySwapsProps = {}) {
  const { isConnected } = useAccount();
  const suiAccount = useCurrentAccount();
  const { data: activeSwapDtos, isLoading: isActiveLoading } = useActiveSwaps();
  const { data: historyPage, isLoading: isHistoryLoading } = useSwapHistory();
  const refreshAll = useRefreshDexData();
  const { t } = useTranslation();
  const [filterView, setFilterView] = useState<FilterView>(initialFilter);

  const hasWallet = isConnected || !!suiAccount;
  const isLoading = isActiveLoading || isHistoryLoading;

  // Convert API DTOs to ActiveSwap format for SwapCard compatibility
  const activeSwaps = useMemo(
    () => (activeSwapDtos || []).map(swapDtoToActiveSwap),
    [activeSwapDtos]
  );

  const historySwaps = useMemo(
    () => (historyPage?.content || []).map(swapDtoToActiveSwap),
    [historyPage]
  );

  // Split active into "In Progress" (matched+) and "Open" (order_created)
  const inProgressOrders = useMemo(
    () => activeSwaps.filter((s) => s.phase !== 'order_created'),
    [activeSwaps]
  );

  const openOrders = useMemo(
    () => activeSwaps.filter((s) => s.phase === 'order_created'),
    [activeSwaps]
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
        <Button size="sm" variant="secondary" onClick={refreshAll} loading={isLoading}>
          Refresh
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
                    onUpdate={refreshAll}
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
                    onUpdate={refreshAll}
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
                    onUpdate={refreshAll}
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
