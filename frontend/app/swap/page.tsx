'use client';

import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { CrossChainSwapForm } from '@/components/swap/CrossChainSwapForm';
import { CrossChainOrderList } from '@/components/swap/CrossChainOrderList';
import { MySwaps } from '@/components/swap/MySwaps';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';
import { useTranslation } from '@/hooks/useTranslation';

type TabId = 'create' | 'orders' | 'myswaps';

export default function SwapPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<TabId>('create');
  const { t } = useTranslation();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('swap.connectWallet')}</h1>
          <p className="text-gray-400 mb-6">{t('swap.connectWalletDesc')}</p>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'create', label: t('swap.createSwap') },
    { id: 'orders', label: t('swap.availableOrders') },
    { id: 'myswaps', label: t('swap.mySwaps') },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('swap.title')}</h1>
            <p className="text-gray-400 mt-1">{t('swap.subtitle')}</p>
          </div>

          {/* Chain Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Chain:</span>
            <div className="flex gap-2">
              {supportedChains.map((chain) => {
                const config = chainConfig[chain.id as SupportedChainId];
                return (
                  <Button
                    key={chain.id}
                    variant={chainId === chain.id ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => switchChain?.({ chainId: chain.id })}
                    className="flex items-center gap-1.5"
                    style={{
                      borderColor: chainId === chain.id ? config?.color : undefined,
                    }}
                  >
                    {config?.icon && (
                      <img src={config.icon} alt="" className="w-4 h-4" />
                    )}
                    {config?.shortName}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          className="mb-6"
        />

        {/* Content */}
        <TabPanel key={activeTab}>
          {activeTab === 'create' && <CrossChainSwapForm />}
          {activeTab === 'orders' && <CrossChainOrderList />}
          {activeTab === 'myswaps' && <MySwaps />}
        </TabPanel>

        {/* Info Card */}
        <Card className="mt-8 p-6 bg-light-hover/50 dark:bg-dark-hover/50">
          <h3 className="text-lg font-semibold mb-3">{t('swap.howItWorks.title')}</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center font-bold">1</div>
              <p>
                <strong className="text-gray-900 dark:text-white">{t('swap.howItWorks.step1.title')}</strong><br />
                {t('swap.howItWorks.step1.desc')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center font-bold">2</div>
              <p>
                <strong className="text-gray-900 dark:text-white">{t('swap.howItWorks.step2.title')}</strong><br />
                {t('swap.howItWorks.step2.desc')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center font-bold">3</div>
              <p>
                <strong className="text-gray-900 dark:text-white">{t('swap.howItWorks.step3.title')}</strong><br />
                {t('swap.howItWorks.step3.desc')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
