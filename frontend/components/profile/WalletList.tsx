'use client';

import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supportedChains } from '@/lib/contracts/config';
import { chainConfig, SupportedChainId, getExplorerAddressUrl } from '@/lib/contracts/addresses';

export function WalletList() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!address) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-400">Connect your wallet to view balances</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Wallet */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Connected Wallet</h3>
          <Badge variant="success">Active</Badge>
        </div>
        <div className="p-4 rounded-lg bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Address</span>
            <a
              href={getExplorerAddressUrl(chainId, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              View on Explorer
            </a>
          </div>
          <p className="font-mono text-sm break-all">{address}</p>
        </div>
      </Card>

      {/* Balances by Chain */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Balances by Chain</h3>
        <div className="space-y-3">
          {supportedChains.map((chain) => (
            <ChainBalance
              key={chain.id}
              chainId={chain.id}
              address={address}
              isActive={chain.id === chainId}
              onSwitch={() => switchChain?.({ chainId: chain.id })}
            />
          ))}
        </div>
      </Card>

      {/* Info */}
      <Card className="p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-gray-300">
              Your wallet is connected via browser extension. Private keys never leave your device.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Switch between chains to view balances on different networks.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ChainBalance({
  chainId,
  address,
  isActive,
  onSwitch,
}: {
  chainId: number;
  address: `0x${string}`;
  isActive: boolean;
  onSwitch: () => void;
}) {
  const config = chainConfig[chainId as SupportedChainId];
  const { data: balance, isLoading } = useBalance({
    address,
    chainId,
  });

  return (
    <div
      className={`p-4 rounded-lg transition-colors ${
        isActive ? 'bg-gray-700/50 ring-1 ring-gray-600' : 'bg-gray-800/50 hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: `${config?.color}20`, color: config?.color }}
          >
            {config?.shortName.charAt(0)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{config?.name}</span>
              {isActive && (
                <Badge variant="success" className="text-xs">Active</Badge>
              )}
            </div>
            <p className="text-sm text-gray-400">{config?.nativeCurrency.symbol}</p>
          </div>
        </div>
        <div className="text-right">
          {isLoading ? (
            <div className="h-6 w-24 bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-lg font-semibold">
              {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0'}
              <span className="text-gray-400 text-sm ml-1">{balance?.symbol}</span>
            </p>
          )}
          {!isActive && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={onSwitch}
            >
              Switch
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
