'use client';

import { useAccount, usePublicClient } from 'wagmi';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getContractAddress } from '@/lib/contracts/addresses';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';

const HTLC_STATUS_MAP: Record<number, string> = {
  0: 'Empty',
  1: 'Active',
  2: 'Withdrawn',
  3: 'Refunded',
};

export function LocalStorageDebug() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [swaps, setSwaps] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string>('');

  const loadSwaps = () => {
    if (!address || typeof window === 'undefined') return;
    const key = `dex_swaps_${address.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSwaps(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSwaps([]);
      }
    }
  };

  useEffect(() => {
    loadSwaps();
  }, [address]);

  if (!address) return null;

  const order7 = swaps.find(s => s.orderId === '7');

  const findMatcherHTLC = async () => {
    if (!order7) {
      setSearchResult('Order #7 not found in localStorage');
      return;
    }

    setIsSearching(true);
    setSearchResult('Searching for matcher HTLC on Polygon Amoy...');

    try {
      const targetChainId = order7.targetChainId || 80002;
      const matcher = order7.matcher;
      const creator = order7.creator;

      if (!matcher || !creator) {
        setSearchResult('Missing matcher or creator address');
        setIsSearching(false);
        return;
      }

      const client = publicClient;
      if (!client) { setSearchResult('Wallet not connected'); setIsSearching(false); return; }
      const htlcAddress = getContractAddress(targetChainId, 'htlc') as `0x${string}`;

      // Get all swap IDs where matcher is the initiator
      const swapIds = await client.readContract({
        address: htlcAddress,
        abi: HTLC_ABI,
        functionName: 'getSwapsAsInitiator',
        args: [matcher as `0x${string}`],
      }) as `0x${string}`[];

      setSearchResult(`Found ${swapIds.length} HTLCs created by matcher. Scanning...`);

      // Search for HTLC with creator as participant (no hashlock filter)
      const lowerCreator = creator.toLowerCase();
      let found: any = null;

      for (const swapId of swapIds) {
        const swapData = await client.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: 'getSwap',
          args: [swapId],
        }) as any;

        const status = HTLC_STATUS_MAP[swapData.status] || 'Empty';
        if (status === 'Empty' || status === 'Refunded') continue;
        if (swapData.participant.toLowerCase() !== lowerCreator) continue;

        // Found it!
        found = {
          swapId,
          hashlock: swapData.hashlock,
          status,
          timelock: swapData.timelock.toString(),
          amount: swapData.amount.toString(),
        };
        break;
      }

      if (found) {
        setSearchResult(`✅ Found matcher HTLC!\n\nSwap ID: ${found.swapId}\nHashlock: ${found.hashlock}\nStatus: ${found.status}\nTimelock: ${found.timelock}\nAmount: ${found.amount}\n\nNow updating localStorage...`);

        // Update localStorage
        const key = `dex_swaps_${address.toLowerCase()}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const swapsData = JSON.parse(raw);
          const index = swapsData.findIndex((s: any) => s.orderId === '7');
          if (index !== -1) {
            swapsData[index].matcherHtlcSwapId = found.swapId;
            // Keep both hashlocks in metadata for reference
            swapsData[index].matcherHashlock = found.hashlock;
            swapsData[index].updatedAt = Date.now();
            localStorage.setItem(key, JSON.stringify(swapsData));
            loadSwaps();
            setSearchResult((prev) => prev + '\n\n✅ Updated! Please refresh the page.');
          }
        }
      } else {
        setSearchResult('❌ No matcher HTLC found with creator as participant');
      }
    } catch (err: any) {
      setSearchResult(`Error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card className="p-4 my-4 space-y-4">
      <div>
        <h3 className="text-lg font-bold mb-2">Debug: Order #7 LocalStorage</h3>
        {order7 ? (
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-96">
            {JSON.stringify(order7, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500">Order #7 not found in localStorage</p>
        )}
      </div>

      {order7 && order7.role === 'matcher' && !order7.matcherHtlcSwapId && (
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Recovery Tool</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Order #7 has mismatched hashlocks. Click below to manually discover the matcher's HTLC on Polygon Amoy.
          </p>
          <Button
            onClick={findMatcherHTLC}
            disabled={isSearching}
            variant="primary"
          >
            {isSearching ? 'Searching...' : 'Find Matcher HTLC'}
          </Button>
          {searchResult && (
            <pre className="mt-3 text-xs bg-blue-50 dark:bg-blue-900/20 p-3 rounded whitespace-pre-wrap">
              {searchResult}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}
