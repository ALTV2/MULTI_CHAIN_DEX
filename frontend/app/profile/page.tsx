'use client';

import { useState } from 'react';
import { useAccount, useChainId, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { WalletList } from '@/components/profile/WalletList';
import { SwapHistoryTable } from '@/components/profile/SwapHistoryTable';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';

type Tab = 'overview' | 'wallets' | 'history' | 'settings';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Personal Cabinet</h1>
          <p className="text-gray-400 mb-6">
            Connect your wallet to access your personal cabinet.
          </p>
          <p className="text-sm text-gray-500">
            View your balances, swap history, and manage your account.
          </p>
        </Card>
      </div>
    );
  }

  const currentChainConfig = chainConfig[chainId as SupportedChainId];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Personal Cabinet</h1>
            <p className="text-gray-400 mt-1">
              Manage your wallets and view swap history
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="success">Connected</Badge>
            <span
              className="px-3 py-1 rounded text-sm font-medium"
              style={{ backgroundColor: `${currentChainConfig?.color}20`, color: currentChainConfig?.color }}
            >
              {currentChainConfig?.shortName}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'wallets', label: 'Wallets' },
            { id: 'history', label: 'Swap History' },
            { id: 'settings', label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab(tab.id as Tab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <OverviewTab address={address!} balance={balance} chainId={chainId} />
        )}
        {activeTab === 'wallets' && <WalletList />}
        {activeTab === 'history' && <SwapHistoryTable />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function OverviewTab({
  address,
  balance,
  chainId,
}: {
  address: `0x${string}`;
  balance: any;
  chainId: number;
}) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Wallet Card */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Connected Wallet</h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Address</p>
            <p className="text-sm font-mono truncate">{address}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Balance</p>
            <p className="text-2xl font-bold">
              {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0'}{' '}
              <span className="text-gray-400 text-lg">{balance?.symbol}</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Multi-Chain Balances */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Chain Balances</h3>
        <div className="space-y-3">
          {supportedChains.map((chain) => {
            const config = chainConfig[chain.id as SupportedChainId];
            return (
              <div key={chain.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config?.color }}
                  />
                  <span className="text-sm">{config?.shortName}</span>
                </div>
                <span className="text-sm text-gray-400">
                  {chain.id === chainId && balance
                    ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}`
                    : '--'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick Stats */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Activity</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Total Swaps</span>
            <span className="font-semibold">0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Active Orders</span>
            <span className="font-semibold">0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Pending Swaps</span>
            <span className="font-semibold">0</span>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-6 md:col-span-2 lg:col-span-3">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No recent activity</p>
          <p className="text-sm mt-1">Your swap history will appear here</p>
        </div>
      </Card>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-gray-400">Use dark theme</p>
            </div>
            <Button variant="secondary" size="sm">
              Enabled
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notifications</p>
              <p className="text-sm text-gray-400">Receive swap notifications</p>
            </div>
            <Button variant="secondary" size="sm">
              Configure
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Security</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Transaction Signing</p>
              <p className="text-sm text-gray-400">Always confirm transactions in wallet</p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-lock</p>
              <p className="text-sm text-gray-400">Disconnect wallet after inactivity</p>
            </div>
            <Button variant="secondary" size="sm">
              Configure
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-red-500/20">
        <h3 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Disconnect Wallet</p>
            <p className="text-sm text-gray-400">Remove wallet connection from this dApp</p>
          </div>
          <Button variant="secondary" size="sm" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
            Disconnect
          </Button>
        </div>
      </Card>
    </div>
  );
}
