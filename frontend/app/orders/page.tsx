'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { ChainPairSelector } from '@/components/orders/ChainPairSelector';
import { UnifiedOrderTable } from '@/components/orders/UnifiedOrderTable';
import { MatchOrderModal } from '@/components/orders/MatchOrderModal';
import { UnifiedCreateOrderForm } from '@/components/orders/UnifiedCreateOrderForm';
import { MySwaps } from '@/components/swap/MySwaps';
import { getTradingMode } from '@/lib/utils/tradingMode';
import { useTranslation } from '@/hooks/useTranslation';
import type { UnifiedOrder } from '@/types/order-unified';
import { getTokensByChainId } from '@/lib/constants/tokens';

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'browse';
  const myOrdersFilter = searchParams.get('filter') as 'inProgress' | 'open' | 'history' || 'inProgress';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sourceChainId, setSourceChainId] = useState<number | string>(sepolia.id);
  const [targetChainId, setTargetChainId] = useState<number | string>(polygonAmoy.id);
  const { t } = useTranslation();

  const handleOrderCreated = () => {
    // Navigate to "My Orders" tab with "Open" filter
    router.push('/orders?tab=myorders&filter=open');
    setActiveTab('myorders');
  };

  const sourceTokens = getTokensByChainId(sourceChainId);
  const targetTokens = getTokensByChainId(targetChainId);

  const [sourceToken, setSourceToken] = useState<string>(sourceTokens[1]?.address ?? '');
  const [targetToken, setTargetToken] = useState<string>(targetTokens[1]?.address ?? '');

  const [matchingOrder, setMatchingOrder] = useState<UnifiedOrder | null>(null);
  const [matchingOrderChainId, setMatchingOrderChainId] = useState<number | string | null>(null);

  const tradingMode = getTradingMode(sourceChainId, targetChainId);
  const isSameChain = tradingMode === 'same-chain';

  function handleSourceChainChange(chainId: number | string) {
    setSourceChainId(chainId);
    const tokens = getTokensByChainId(chainId);
    setSourceToken(tokens[1]?.address ?? tokens[0]?.address ?? '');
  }

  function handleTargetChainChange(chainId: number | string) {
    setTargetChainId(chainId);
    const tokens = getTokensByChainId(chainId);
    setTargetToken(tokens[1]?.address ?? tokens[0]?.address ?? '');
  }

  function handleMatchOrder(order: UnifiedOrder, orderSourceChainId: number | string) {
    setMatchingOrder(order);
    setMatchingOrderChainId(orderSourceChainId);
  }

  const tabs = [
    { id: 'browse', label: t('orders.browseOrders') },
    { id: 'create', label: t('orders.createOrder') },
    { id: 'myorders', label: t('orders.myOrders') },
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
        {activeTab === 'browse' && (
          <Badge variant={isSameChain ? 'warning' : 'info'}>
            {isSameChain ? t('orders.sameChain') : t('orders.crossChain')}
          </Badge>
        )}
      </div>

      {/* Chain Pair Selector — only for browse tab */}
      {activeTab === 'browse' && (
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
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'browse' && (
        <TabPanel>
          <Card>
            <CardContent>
              <UnifiedOrderTable
                sourceChainId={sourceChainId}
                targetChainId={targetChainId}
                sourceToken={sourceToken}
                targetToken={targetToken}
                onMatchOrder={handleMatchOrder}
              />
            </CardContent>
          </Card>
        </TabPanel>
      )}

      {activeTab === 'create' && (
        <TabPanel>
          <UnifiedCreateOrderForm onOrderCreated={handleOrderCreated} />
        </TabPanel>
      )}

      {activeTab === 'myorders' && (
        <TabPanel>
          <MySwaps initialFilter={myOrdersFilter} />
        </TabPanel>
      )}

      {/* Match Modal — cross-chain only */}
      {matchingOrder && matchingOrderChainId && (
        <MatchOrderModal
          open={!!matchingOrder}
          onClose={() => {
            setMatchingOrder(null);
            setMatchingOrderChainId(null);
          }}
          order={matchingOrder}
          sourceChainId={matchingOrderChainId}
        />
      )}
    </div>
  );
}
