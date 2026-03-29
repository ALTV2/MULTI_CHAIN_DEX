'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TokenIcon } from '@/components/common/TokenIcon';
import { getChainConfig } from '@/lib/contracts/addresses';
import { useOrderBook } from '@/hooks/useDexApi';
import type { OrderDto } from '@/lib/api/dexApi';
import { useTranslation } from '@/hooks/useTranslation';

/** Adapt OrderDto to the shape LiveOrderCard expects. */
type LiveOrder = {
  id: string;
  sourceChainId: number | string;
  targetChainId: number | string;
  type: 'same-chain' | 'cross-chain';
  sellSymbol: string;
  buySymbol: string;
  formattedSellAmount: string;
  formattedBuyAmount: string;
  creator: string;
  expiresAt: bigint;
};

function orderDtoToLiveOrder(o: OrderDto): LiveOrder {
  return {
    id: `${o.sourceChainId}-${o.onChainOrderId}`,
    sourceChainId: o.sourceChainId.includes(':') ? o.sourceChainId : Number(o.sourceChainId),
    targetChainId: o.targetChainId ? (o.targetChainId.includes(':') ? o.targetChainId : Number(o.targetChainId)) : (o.sourceChainId.includes(':') ? o.sourceChainId : Number(o.sourceChainId)),
    type: o.orderType === 'CROSS_CHAIN' ? 'cross-chain' : 'same-chain',
    sellSymbol: o.sellToken?.symbol || '???',
    buySymbol: o.buyToken?.symbol || '???',
    formattedSellAmount: o.formattedSellAmount,
    formattedBuyAmount: o.formattedBuyAmount,
    creator: o.creator,
    expiresAt: o.expiresAt ? BigInt(o.expiresAt) : BigInt(0),
  };
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeUntil(expiresAt: bigint | number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(expiresAt) - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function OrderRow({ order }: { order: LiveOrder }) {
  const srcConfig = getChainConfig(order.sourceChainId);
  const tgtConfig = getChainConfig(order.targetChainId);
  const isSameChain = order.sourceChainId === order.targetChainId;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-[80px_1fr_auto_1fr_100px_80px] gap-4 items-center px-4 py-3 rounded-lg hover:bg-gradient-to-r hover:from-light-hover/40 hover:to-transparent dark:hover:from-dark-hover/40 dark:hover:to-transparent transition-all duration-200 border border-transparent hover:border-accent-blue/10"
    >
      {/* Chain Flow */}
      <div className="flex items-center justify-center gap-1.5">
        {srcConfig?.icon && (
          <div className="relative">
            <img src={srcConfig.icon} alt="" className="w-6 h-6 rounded-full ring-2 ring-white/10" />
          </div>
        )}
        {!isSameChain ? (
          <>
            <svg className="w-3.5 h-3.5 text-accent-blue/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            {tgtConfig?.icon && (
              <div className="relative">
                <img src={tgtConfig.icon} alt="" className="w-6 h-6 rounded-full ring-2 ring-white/10" />
              </div>
            )}
          </>
        ) : (
          <Badge variant="info" className="text-[10px] px-1.5 py-0.5">On-Chain</Badge>
        )}
      </div>

      {/* Sell Token */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-shrink-0">
          <TokenIcon symbol={order.sellSymbol} size={22} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {parseFloat(order.formattedSellAmount).toFixed(4)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {order.sellSymbol}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center">
        <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>

      {/* Buy Token */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-shrink-0">
          <TokenIcon symbol={order.buySymbol} size={22} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {parseFloat(order.formattedBuyAmount).toFixed(4)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {order.buySymbol}
          </span>
        </div>
      </div>

      {/* Creator */}
      <div className="hidden lg:flex items-center justify-center">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 px-2 py-1 rounded">
          {truncateAddr(order.creator)}
        </span>
      </div>

      {/* Expiry */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent-blue/5 border border-accent-blue/10">
          <svg className="w-3 h-3 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-accent-blue">
            {timeUntil(order.expiresAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function LiveOrderFeed() {
  const { data: page, isLoading, refetch } = useOrderBook({ status: 'ACTIVE', size: 20 });
  const orders = (page?.content || []).map(orderDtoToLiveOrder);
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);

  const handleLoad = () => {
    setLoaded(true);
    refetch();
  };

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-light-hover/30 to-transparent dark:from-dark-hover/30 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-accent-blue rounded-full" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('dashboard.liveFeed.title')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Live Updates</span>
          </div>
        </div>

        {/* Column Headers */}
        {!isLoading && orders && orders.length > 0 && (
          <div className="grid grid-cols-[80px_1fr_auto_1fr_100px_80px] gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase text-center">
              Route
            </div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Selling
            </div>
            <div className="w-4" />
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Buying
            </div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase text-center hidden lg:block">
              Creator
            </div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">
              Expires
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-2 py-2">
          {!loaded && !orders?.length ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <button
                onClick={handleLoad}
                className="px-6 py-3 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-accent-blue font-medium text-sm hover:bg-accent-blue/20 transition-colors"
              >
                Load Active Orders
              </button>
              <p className="text-xs text-gray-500 mt-2">Click to fetch orders from blockchain</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-gradient-to-r from-light-hover/50 to-light-hover/20 dark:from-dark-hover/50 dark:to-dark-hover/20 animate-pulse"
                />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('dashboard.liveFeed.empty')}
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              <AnimatePresence mode="popLayout">
                {orders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
