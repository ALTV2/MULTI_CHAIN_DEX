'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, useBalance, useChainId, useDisconnect } from 'wagmi';
import { formatEther } from 'viem';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { WalletList } from '@/components/profile/WalletList';
import { SwapHistoryTable } from '@/components/profile/SwapHistoryTable';
import { useCurrentUser } from '@/hooks/useAuth';
import { useAllUserOrders } from '@/hooks/useAllUserOrders';
import { useSettingsStore, type SecretStorageMode } from '@/stores/useSettingsStore';
import { chainConfig, SupportedChainId, getSupportedChainIds } from '@/lib/contracts/addresses';
import { supportedChains } from '@/lib/contracts/config';
import { useTranslation } from '@/hooks/useTranslation';

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });
  const { disconnect } = useDisconnect();
  const { isAuthenticated } = useCurrentUser();
  const { activeSwaps, historySwaps } = useAllUserOrders();
  const { t } = useTranslation();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('profile.connectWallet')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t('profile.connectWalletDesc')}
        </p>
      </div>
    );
  }

  const currentChainConfig = chainConfig[chainId as SupportedChainId];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('profile.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {address?.slice(0, 8)}...{address?.slice(-6)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && <Badge variant="success" dot>{t('profile.signedIn')}</Badge>}
          <Badge
            variant="info"
            style={{ backgroundColor: `${currentChainConfig?.color}20`, color: currentChainConfig?.color }}
          >
            {currentChainConfig?.shortName}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: t('profile.tabs.overview') },
          { id: 'wallets', label: t('profile.tabs.wallets') },
          { id: 'history', label: t('profile.tabs.history') },
          { id: 'settings', label: t('profile.tabs.settings') },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <TabPanel>
          <div className="grid md:grid-cols-3 gap-6">
            <Card variant="glass">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t('profile.balance')}</span>
                  <span className="text-xs" style={{ color: currentChainConfig?.color }}>
                    {currentChainConfig?.shortName}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0'}
                  <span className="text-lg text-gray-400 ml-1">{balance?.symbol}</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="space-y-3">
                <span className="text-sm text-gray-500">{t('profile.inProgress')}</span>
                <div className="text-3xl font-bold text-accent-blue">{activeSwaps.length}</div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="space-y-3">
                <span className="text-sm text-gray-500">{t('profile.completed')}</span>
                <div className="text-3xl font-bold text-accent-green">{historySwaps.length}</div>
              </CardContent>
            </Card>

            {/* Chain balances */}
            <Card className="md:col-span-3">
              <CardContent>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('profile.chainBalances')}</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {supportedChains.map((chain) => {
                    const config = chainConfig[chain.id as SupportedChainId];
                    return (
                      <ChainBalanceCard
                        key={chain.id}
                        chainId={chain.id}
                        address={address!}
                        isActive={chain.id === chainId}
                        config={config}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      )}

      {activeTab === 'wallets' && (
        <TabPanel>
          <WalletList />
        </TabPanel>
      )}

      {activeTab === 'history' && (
        <TabPanel>
          <SwapHistoryTable />
        </TabPanel>
      )}

      {activeTab === 'settings' && (
        <TabPanel>
          <SettingsPanel onDisconnect={() => disconnect()} />
        </TabPanel>
      )}
    </div>
  );
}

function ChainBalanceCard({
  chainId,
  address,
  isActive,
  config,
}: {
  chainId: number;
  address: `0x${string}`;
  isActive: boolean;
  config: any;
}) {
  const { data: balance, isLoading } = useBalance({ address, chainId });
  const { t } = useTranslation();

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
      isActive
        ? 'bg-light-hover dark:bg-dark-hover ring-1 ring-accent-blue/30'
        : 'bg-light-hover/50 dark:bg-dark-hover/50'
    }`}>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ backgroundColor: `${config?.color}15`, color: config?.color }}
        >
          {config?.shortName.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">{config?.name}</div>
          {isActive && <span className="text-xs text-accent-green">{t('profile.connected')}</span>}
        </div>
      </div>
      <div className="text-right">
        {isLoading ? (
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0'}
            <span className="text-gray-400 ml-1">{balance?.symbol}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ onDisconnect }: { onDisconnect: () => void }) {
  const { secretStorage, setSecretStorage, defaultTargetWallets } = useSettingsStore();
  const { t } = useTranslation();

  const secretOptions: { value: SecretStorageMode; label: string; desc: string }[] = [
    { value: 'local', label: t('profile.settings.localStorage'), desc: t('profile.settings.localStorageDesc') },
    { value: 'database', label: t('profile.settings.database'), desc: t('profile.settings.databaseDesc') },
    { value: 'show_once', label: t('profile.settings.showOnce'), desc: t('profile.settings.showOnceDesc') },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Secret Storage */}
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('profile.settings.secretStorage')}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t('profile.settings.secretStorageDesc')}
            </p>
          </div>
          <div className="space-y-2">
            {secretOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  secretStorage === opt.value
                    ? 'border-accent-blue bg-accent-blue/5'
                    : 'border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover'
                }`}
              >
                <input
                  type="radio"
                  name="secretStorage"
                  value={opt.value}
                  checked={secretStorage === opt.value}
                  onChange={() => setSecretStorage(opt.value)}
                  className="mt-1 w-4 h-4 text-accent-blue focus:ring-accent-blue border-gray-300 dark:border-gray-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Default Target Wallets */}
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('profile.settings.targetWallets')}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t('profile.settings.targetWalletsDesc')}
            </p>
          </div>
          {Object.keys(defaultTargetWallets).length === 0 ? (
            <p className="text-sm text-gray-400 italic">{t('profile.settings.noWallets')}</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(defaultTargetWallets).map(([chainId, addr]) => (
                <div key={chainId} className="flex items-center justify-between p-3 bg-light-hover dark:bg-dark-hover rounded-xl">
                  <div>
                    <span className="text-xs text-gray-400">Chain {chainId}</span>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">{addr.slice(0, 10)}...{addr.slice(-6)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect */}
      <Card className="border-accent-red/20">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{t('profile.settings.disconnect')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t('profile.settings.disconnectDesc')}</p>
            </div>
            <Button variant="danger" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
