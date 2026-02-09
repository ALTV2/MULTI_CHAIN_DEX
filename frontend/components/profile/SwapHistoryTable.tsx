'use client';

import { useState, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { chainConfig, SupportedChainId, getExplorerTxUrl } from '@/lib/contracts/addresses';

type SwapStatus = 'pending' | 'completed' | 'failed' | 'refunded';

interface SwapRecord {
  id: string;
  sourceChainId: number;
  targetChainId: number;
  sourceToken: string;
  sourceAmount: bigint;
  targetToken: string;
  targetAmount: bigint;
  status: SwapStatus;
  txHash?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Mock data for demonstration - in production this would come from backend or on-chain events
const mockSwaps: SwapRecord[] = [];

export function SwapHistoryTable() {
  const { address } = useAccount();
  const [filter, setFilter] = useState<SwapStatus | 'all'>('all');

  const filteredSwaps = useMemo(() => {
    if (filter === 'all') return mockSwaps;
    return mockSwaps.filter((swap) => swap.status === filter);
  }, [filter]);

  if (!address) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-400">Connect your wallet to view swap history</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400 mr-2">Filter:</span>
          {(['all', 'pending', 'completed', 'failed', 'refunded'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Table or Empty State */}
      {filteredSwaps.length === 0 ? (
        <Card className="p-8 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">No Swaps Yet</h3>
          <p className="text-gray-400 mb-4">
            Your cross-chain swap history will appear here once you complete your first swap.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/swap'}>
            Start Swapping
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Date</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">From</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">To</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredSwaps.map((swap) => (
                  <SwapRow key={swap.id} swap={swap} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-gray-800/30">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-400">
            <p>Swap history is synced from blockchain events. Recent swaps may take a few moments to appear.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SwapRow({ swap }: { swap: SwapRecord }) {
  const sourceConfig = chainConfig[swap.sourceChainId as SupportedChainId];
  const targetConfig = chainConfig[swap.targetChainId as SupportedChainId];

  const statusVariant: Record<SwapStatus, 'success' | 'warning' | 'error' | 'default'> = {
    pending: 'warning',
    completed: 'success',
    failed: 'error',
    refunded: 'default',
  };

  return (
    <tr className="hover:bg-gray-800/30 transition-colors">
      <td className="p-4">
        <p className="text-sm">{swap.createdAt.toLocaleDateString()}</p>
        <p className="text-xs text-gray-500">{swap.createdAt.toLocaleTimeString()}</p>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${sourceConfig?.color}20`, color: sourceConfig?.color }}
          >
            {sourceConfig?.shortName.charAt(0)}
          </span>
          <span className="text-sm">{sourceConfig?.shortName}</span>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${targetConfig?.color}20`, color: targetConfig?.color }}
          >
            {targetConfig?.shortName.charAt(0)}
          </span>
          <span className="text-sm">{targetConfig?.shortName}</span>
        </div>
      </td>
      <td className="p-4">
        <p className="text-sm">
          {formatEther(swap.sourceAmount)} {swap.sourceToken}
        </p>
        <p className="text-xs text-gray-500">
          for {formatEther(swap.targetAmount)} {swap.targetToken}
        </p>
      </td>
      <td className="p-4">
        <Badge variant={statusVariant[swap.status]}>
          {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
        </Badge>
      </td>
      <td className="p-4">
        {swap.txHash && (
          <a
            href={getExplorerTxUrl(swap.sourceChainId, swap.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            View Tx
          </a>
        )}
      </td>
    </tr>
  );
}
