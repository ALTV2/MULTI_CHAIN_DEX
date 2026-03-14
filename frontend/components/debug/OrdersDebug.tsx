'use client';

import { useOrderBookForChain } from '@/hooks/useOrderBookForChain';
import { useAllSameChainOrdersFixed } from '@/hooks/useAllSameChainOrdersFixed';
import { useAllUnifiedOrdersFixed } from '@/hooks/useAllUnifiedOrdersFixed';
import { useAllOrders } from '@/hooks/useAllOrders';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { useChainId } from 'wagmi';
import { getContractAddress } from '@/lib/contracts/addresses';

export function OrdersDebug() {
  const currentChainId = useChainId();

  // Get real token addresses from deployed contracts
  const sepoliaTokenA = getContractAddress(sepolia.id, 'testTokenA');
  const sepoliaTokenB = getContractAddress(sepolia.id, 'testTokenB');

  // Test individual chain fetching
  const sepoliaOrders = useOrderBookForChain(sepolia.id);
  const amoyOrders = useOrderBookForChain(polygonAmoy.id);

  // Test fixed hooks
  const { orders: sameChainOrders, isLoading: isSameChainLoading } = useAllSameChainOrdersFixed();
  const { orders: crossChainOrders, isLoading: isCrossChainLoading } = useAllUnifiedOrdersFixed();

  // Test final hook with filters - using REAL token addresses
  const { orders: filteredOrders, isLoading: isFilteredLoading } = useAllOrders({
    sourceChainId: sepolia.id,
    targetChainId: sepolia.id,
    sourceToken: sepoliaTokenA,
    targetToken: sepoliaTokenB,
  });

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-gray-800 rounded-lg border-4 border-red-500">
      <h2 className="text-2xl font-bold text-red-600">🔍 Orders Debug Panel 🔍</h2>

      <div className="space-y-2">
        <p><strong>Current Wallet Chain:</strong> {currentChainId || 'Not connected'}</p>
        <p><strong>Loading States:</strong></p>
        <ul className="ml-4">
          <li>Same-chain: {isSameChainLoading ? '⏳ Loading...' : '✅ Loaded'}</li>
          <li>Cross-chain: {isCrossChainLoading ? '⏳ Loading...' : '✅ Loaded'}</li>
          <li>Filtered: {isFilteredLoading ? '⏳ Loading...' : '✅ Loaded'}</li>
        </ul>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-bold text-lg mb-2">1. Direct Sepolia Orders ({sepoliaOrders.orders.length})</h3>
        <p className="text-sm text-gray-600">Loading: {sepoliaOrders.isLoading ? 'Yes' : 'No'}</p>
        <p className="text-sm text-gray-600">Error: {sepoliaOrders.isError ? 'Yes' : 'No'}</p>
        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(sepoliaOrders.orders, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          , 2)}
        </pre>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-bold text-lg mb-2">2. Direct Polygon Amoy Orders ({amoyOrders.orders.length})</h3>
        <p className="text-sm text-gray-600">Loading: {amoyOrders.isLoading ? 'Yes' : 'No'}</p>
        <p className="text-sm text-gray-600">Error: {amoyOrders.isError ? 'Yes' : 'No'}</p>
        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(amoyOrders.orders, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          , 2)}
        </pre>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-bold text-lg mb-2">3. Same-Chain Orders Fixed ({sameChainOrders.length})</h3>
        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(sameChainOrders.map(o => ({
            id: o.id.toString(),
            chain: o.sourceChainIdNum,
            sell: o.sellSymbol,
            buy: o.buySymbol,
            sellAmount: o.formattedSellAmount,
            buyAmount: o.formattedBuyAmount,
          })), null, 2)}
        </pre>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-bold text-lg mb-2">4. Cross-Chain Orders Fixed ({crossChainOrders.length})</h3>
        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(crossChainOrders.map(o => ({
            id: o.id.toString(),
            source: o.sourceChainIdNum,
            target: o.targetChainIdNum,
            sell: o.sellSymbol,
            buy: o.buySymbol,
            sellAmount: o.formattedSellAmount,
            buyAmount: o.formattedBuyAmount,
          })), null, 2)}
        </pre>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-bold text-lg mb-2">5. Filtered Orders (Sepolia TKA→TKB) ({filteredOrders.length})</h3>
        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(filteredOrders.map(o => ({
            id: o.id.toString(),
            chain: o.sourceChainIdNum,
            sell: o.sellSymbol,
            buy: o.buySymbol,
            sellAmount: o.formattedSellAmount,
            buyAmount: o.formattedBuyAmount,
          })), null, 2)}
        </pre>
      </div>
    </div>
  );
}
