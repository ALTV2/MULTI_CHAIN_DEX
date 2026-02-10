'use client';

import { useState } from 'react';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { ChainPairSelector } from '@/components/orders/ChainPairSelector';
import { UnifiedOrderTable } from '@/components/orders/UnifiedOrderTable';
import { MatchOrderModal } from '@/components/orders/MatchOrderModal';
import { CrossChainSwapForm } from '@/components/swap/CrossChainSwapForm';
import { CreateOrderForm } from '@/components/trade/CreateOrderForm';
import { SameChainOrderTable } from '@/components/orders/SameChainOrderTable';
import { getTradingMode } from '@/lib/utils/tradingMode';
import { useTranslation } from '@/hooks/useTranslation';
import type { UnifiedOrder } from '@/hooks/useUnifiedOrders';
import { getTokensByChainId } from '@/lib/constants/tokens';

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState('browse');
  const [sourceChainId, setSourceChainId] = useState<number>(sepolia.id);
  const [targetChainId, setTargetChainId] = useState<number>(polygonAmoy.id);
  const { t } = useTranslation();

  const sourceTokens = getTokensByChainId(sourceChainId);
  const targetTokens = getTokensByChainId(targetChainId);

  const [sourceToken, setSourceToken] = useState<string>(sourceTokens[1]?.address ?? '');
  const [targetToken, setTargetToken] = useState<string>(targetTokens[1]?.address ?? '');

  const [matchingOrder, setMatchingOrder] = useState<UnifiedOrder | null>(null);

  const tradingMode = getTradingMode(sourceChainId, targetChainId);
  const isSameChain = tradingMode === 'same-chain';

  function handleSourceChainChange(chainId: number) {
    setSourceChainId(chainId);
    const tokens = getTokensByChainId(chainId);
    setSourceToken(tokens[1]?.address ?? tokens[0]?.address ?? '');
  }

  function handleTargetChainChange(chainId: number) {
    setTargetChainId(chainId);
    const tokens = getTokensByChainId(chainId);
    setTargetToken(tokens[1]?.address ?? tokens[0]?.address ?? '');
  }

  const tabs = [
    { id: 'browse', label: t('orders.browseOrders') },
    { id: 'create', label: t('orders.createOrder') },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('orders.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('orders.subtitle')}
          </p>
        </div>
        <Badge variant={isSameChain ? 'warning' : 'info'}>
          {isSameChain ? t('orders.sameChain') : t('orders.crossChain')}
        </Badge>
      </div>

      {/* Chain Pair Selector */}
      <Card variant="glass-strong" className="relative z-10">
        <CardContent>
          <ChainPairSelector
            sourceChainId={sourceChainId}
            targetChainId={targetChainId}
            sourceToken={sourceToken}
            targetToken={targetToken}
            onSourceChainChange={handleSourceChainChange}
            onTargetChainChange={handleTargetChainChange}
            onSourceTokenChange={setSourceToken}
            onTargetTokenChange={setTargetToken}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'browse' && (
        <TabPanel>
          <Card>
            <CardContent>
              {isSameChain ? (
                <SameChainOrderTable
                  chainId={sourceChainId}
                  sourceToken={sourceToken}
                  targetToken={targetToken}
                />
              ) : (
                <UnifiedOrderTable
                  sourceChainId={sourceChainId}
                  targetChainId={targetChainId}
                  sourceToken={sourceToken}
                  targetToken={targetToken}
                  onMatchOrder={setMatchingOrder}
                />
              )}
            </CardContent>
          </Card>
        </TabPanel>
      )}

      {activeTab === 'create' && (
        <TabPanel>
          {isSameChain ? (
            <CreateOrderForm />
          ) : (
            <Card>
              <CardContent>
                <CrossChainSwapForm />
              </CardContent>
            </Card>
          )}
        </TabPanel>
      )}

      {/* Match Modal — cross-chain only */}
      {!isSameChain && (
        <MatchOrderModal
          open={!!matchingOrder}
          onClose={() => setMatchingOrder(null)}
          order={matchingOrder}
          sourceChainId={sourceChainId}
        />
      )}
    </div>
  );
}
