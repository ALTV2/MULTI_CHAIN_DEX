'use client';

import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { useOrderBook } from '@/hooks/useOrderBook';
import { useAllUserOrders } from '@/hooks/useAllUserOrders';
import { getSupportedChainIds } from '@/lib/contracts/addresses';
import { LiveOrderFeed } from '@/components/orders/LiveOrderFeed';
import { AboutSection } from '@/components/common/AboutSection';
import { useTranslation } from '@/hooks/useTranslation';

export default function HomePage() {
  const { isConnected } = useAccount();
  const { orders: allOrders } = useOrderBook();
  const { activeSwaps } = useAllUserOrders();
  const chainCount = getSupportedChainIds().length;
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Hero */}
      <section className="text-center space-y-6 pt-8 pb-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
          </span>
          <span className="text-sm font-medium text-accent-blue">{t('dashboard.badge')}</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          <span className="text-gray-900 dark:text-white">Cross-Chain </span>
          <span className="text-gradient">DEX</span>
        </h1>

        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          {t('dashboard.subtitle')}
        </p>

        <div className="flex items-center justify-center gap-4 pt-2">
          <Link href="/orders" className="btn-gradient inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            {t('orders.browseOrders')}
          </Link>
          {!isConnected && (
            <span className="text-sm text-gray-400">Connect wallet to start trading</span>
          )}
        </div>
      </section>

      {/* Stats — 3 columns, removed Protocol */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('dashboard.stats.activeOrders'), value: allOrders.length, color: 'text-accent-blue' },
          { label: t('dashboard.stats.inProgress'), value: activeSwaps.length, color: 'text-accent-green' },
          { label: t('dashboard.stats.chains'), value: chainCount, color: 'text-accent-purple' },
        ].map((stat) => (
          <Card key={stat.label} variant="glass">
            <CardContent className="text-center py-4">
              <div className={`text-2xl md:text-3xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* CTAs */}
      <section className="grid md:grid-cols-2 gap-6">
        <Link href="/orders" className="block group">
          <Card variant="interactive" className="h-full">
            <CardContent className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-accent-blue transition-colors">
                  {t('dashboard.cta.createOrder')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('dashboard.cta.createOrderDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">Cross-Chain</Badge>
                <Badge variant="outline">No Lock Required</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/orders?tab=myorders" className="block group">
          <Card variant="interactive" className="h-full">
            <CardContent className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-accent-green transition-colors">
                  {t('dashboard.cta.myOrders')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('dashboard.cta.myOrdersDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success">HTLC Atomic</Badge>
                <Badge variant="outline">Trustless</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Live Order Feed */}
      <section>
        <LiveOrderFeed />
      </section>

      {/* How it works */}
      <section>
        <Card variant="glass-strong">
          <CardContent className="py-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              {t('dashboard.howItWorks.title')}
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  step: 1,
                  titleKey: 'dashboard.howItWorks.step1.title' as const,
                  descKey: 'dashboard.howItWorks.step1.desc' as const,
                  color: 'from-accent-blue to-blue-600',
                },
                {
                  step: 2,
                  titleKey: 'dashboard.howItWorks.step2.title' as const,
                  descKey: 'dashboard.howItWorks.step2.desc' as const,
                  color: 'from-accent-purple to-purple-600',
                },
                {
                  step: 3,
                  titleKey: 'dashboard.howItWorks.step3.title' as const,
                  descKey: 'dashboard.howItWorks.step3.desc' as const,
                  color: 'from-accent-green to-green-600',
                },
                {
                  step: 4,
                  titleKey: 'dashboard.howItWorks.step4.title' as const,
                  descKey: 'dashboard.howItWorks.step4.desc' as const,
                  color: 'from-accent-orange to-orange-600',
                },
              ].map(({ step, titleKey, descKey, color }) => (
                <div key={step} className="space-y-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                    {step}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t(titleKey)}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t(descKey)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* About */}
      <section>
        <AboutSection />
      </section>
    </div>
  );
}
