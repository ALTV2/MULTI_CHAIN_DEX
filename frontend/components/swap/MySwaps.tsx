'use client';

import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SwapCard } from './SwapCard';
import { useActiveSwaps } from '@/hooks/useActiveSwaps';

export function MySwaps() {
  const { isConnected } = useAccount();
  const { activeSwaps, historySwaps, isLoading, refetch } = useActiveSwaps();

  if (!isConnected) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-400">Connect your wallet to see your swaps.</p>
      </Card>
    );
  }

  if (isLoading && activeSwaps.length === 0 && historySwaps.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const hasAny = activeSwaps.length > 0 || historySwaps.length > 0;

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Swaps</h2>
        <Button size="sm" variant="secondary" onClick={refetch} loading={isLoading}>
          Refresh
        </Button>
      </div>

      {!hasAny ? (
        <Card className="p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p className="text-gray-400 mb-2">No swaps yet</p>
          <p className="text-sm text-gray-500">
            Create an order or match an existing one to start a cross-chain swap.
          </p>
        </Card>
      ) : (
        <>
          {/* Active Swaps */}
          {activeSwaps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Active ({activeSwaps.length})
              </h3>
              <div className="space-y-4">
                {activeSwaps.map((swap) => (
                  <SwapCard
                    key={swap.meta.orderId}
                    swap={swap}
                    onUpdate={refetch}
                  />
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {historySwaps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                History ({historySwaps.length})
              </h3>
              <div className="space-y-4">
                {historySwaps.map((swap) => (
                  <SwapCard
                    key={swap.meta.orderId}
                    swap={swap}
                    onUpdate={refetch}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
