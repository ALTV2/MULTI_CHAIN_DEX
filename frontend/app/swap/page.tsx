'use client';

import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CrossChainSwapForm } from '@/components/swap/CrossChainSwapForm';
import { CrossChainOrderList } from '@/components/swap/CrossChainOrderList';
import { MySwaps } from '@/components/swap/MySwaps';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId } from '@/lib/contracts/addresses';

type Tab = 'create' | 'orders' | 'myswaps';

export default function SwapPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<Tab>('create');

  const currentChainConfig = chainConfig[chainId as SupportedChainId];

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Cross-Chain Swap</h1>
          <p className="text-gray-400 mb-6">
            Connect your wallet to start cross-chain swaps using HTLC technology.
          </p>
          <p className="text-sm text-gray-500">
            Swap assets between Ethereum and Polygon securely and trustlessly.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cross-Chain Swap</h1>
            <p className="text-gray-400 mt-1">
              Swap assets between chains using HTLC atomic swaps
            </p>
          </div>

          {/* Chain Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Current Chain:</span>
            <div className="flex gap-2">
              {supportedChains.map((chain) => (
                <Button
                  key={chain.id}
                  variant={chainId === chain.id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => switchChain?.({ chainId: chain.id })}
                  style={{
                    borderColor: chainId === chain.id
                      ? chainConfig[chain.id as SupportedChainId]?.color
                      : undefined,
                  }}
                >
                  {chainConfig[chain.id as SupportedChainId]?.shortName}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('create')}
          >
            Create Swap
          </button>
          <button
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'orders'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('orders')}
          >
            Available Orders
          </button>
          <button
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'myswaps'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('myswaps')}
          >
            My Swaps
          </button>
        </div>

        {/* Content */}
        {activeTab === 'create' && <CrossChainSwapForm />}
        {activeTab === 'orders' && <CrossChainOrderList />}
        {activeTab === 'myswaps' && <MySwaps />}

        {/* Info Card */}
        <Card className="mt-8 p-6 bg-gray-800/50">
          <h3 className="text-lg font-semibold mb-3">How Cross-Chain Swaps Work</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                1
              </div>
              <p>
                <strong className="text-white">Create Order</strong><br />
                Specify what you want to swap and create an order on the source chain.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                2
              </div>
              <p>
                <strong className="text-white">HTLC Lock</strong><br />
                Both parties lock funds in Hash Time-Locked Contracts on their respective chains.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                3
              </div>
              <p>
                <strong className="text-white">Atomic Swap</strong><br />
                Reveal the secret to claim funds. If anything fails, funds are automatically refunded.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
