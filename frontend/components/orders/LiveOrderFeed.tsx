'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { TokenIcon } from '@/components/common/TokenIcon';
import { getChainConfig } from '@/lib/contracts/addresses';
import { useLiveOrderFeed, type LiveOrder } from '@/hooks/useLiveOrderFeed';
import { useTranslation } from '@/hooks/useTranslation';

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeUntil(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-light-hover/50 dark:hover:bg-dark-hover/50 transition-colors"
    >
      {/* Chain flow */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {srcConfig?.icon && <img src={srcConfig.icon} alt="" className="w-5 h-5" />}
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {tgtConfig?.icon && <img src={tgtConfig.icon} alt="" className="w-5 h-5" />}
      </div>

      {/* Sell */}
      <div className="flex items-center gap-1.5 min-w-0">
        <TokenIcon symbol={order.sellSymbol} size={20} />
        <span className="text-sm font-medium truncate">
          {parseFloat(order.sellAmount).toFixed(4)} {order.sellSymbol}
        </span>
      </div>

      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>

      {/* Buy */}
      <div className="flex items-center gap-1.5 min-w-0">
        <TokenIcon symbol={order.buySymbol} size={20} />
        <span className="text-sm font-medium truncate">
          {parseFloat(order.buyAmount).toFixed(4)} {order.buySymbol}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Creator */}
      <span className="text-xs text-gray-500 font-mono hidden sm:block">
        {truncateAddr(order.creator)}
      </span>

      {/* Expiry */}
      <span className="text-xs text-gray-400 flex-shrink-0">
        {timeUntil(order.expiresAt)}
      </span>
    </motion.div>
  );
}

export function LiveOrderFeed() {
  const { data: orders, isLoading } = useLiveOrderFeed();
  const { t } = useTranslation();

  return (
    <Card variant="glass">
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('dashboard.liveFeed.title')}
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
            </span>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-light-hover/50 dark:bg-dark-hover/50 animate-pulse" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            {t('dashboard.liveFeed.empty')}
          </div>
        ) : (
          <div className="space-y-0.5 max-h-80 overflow-auto">
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
