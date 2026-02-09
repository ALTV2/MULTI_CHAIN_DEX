'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWithdrawHTLC } from '@/hooks/useHTLC';
import { chainConfig, SupportedChainId, getExplorerTxUrl } from '@/lib/contracts/addresses';

interface SecretRevealProps {
  chainId: number;
  swapId: `0x${string}`;
  onSuccess?: () => void;
}

export function SecretReveal({ chainId, swapId, onSuccess }: SecretRevealProps) {
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const { withdraw, hash, isPending, isConfirming, isSuccess, error } = useWithdrawHTLC(chainId);

  const config = chainConfig[chainId as SupportedChainId];

  const handleWithdraw = async () => {
    if (!secret || !secret.startsWith('0x') || secret.length !== 66) {
      return;
    }

    try {
      await withdraw(swapId, secret as `0x${string}`);
      onSuccess?.();
    } catch (err) {
      console.error('Withdraw failed:', err);
    }
  };

  const isValidSecret = secret.startsWith('0x') && secret.length === 66;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Reveal Secret to Withdraw</h3>

      <div className="space-y-4">
        {/* Info */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-300">
              Enter the secret that was used to create the hashlock. This will be publicly visible on-chain after the transaction.
            </p>
          </div>
        </div>

        {/* Secret Input */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Secret (32 bytes hex)</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder="0x..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="font-mono pr-20"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-white"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? 'Hide' : 'Show'}
            </button>
          </div>
          {secret && !isValidSecret && (
            <p className="text-xs text-red-400 mt-1">
              Secret must be 66 characters (0x + 64 hex characters)
            </p>
          )}
        </div>

        {/* Chain Info */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config?.color }}
          />
          <span>Withdrawing on {config?.name}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error.message}</p>
          </div>
        )}

        {/* Success */}
        {isSuccess && hash && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 mb-2">Withdrawal successful!</p>
            <a
              href={getExplorerTxUrl(chainId, hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View Transaction
            </a>
          </div>
        )}

        {/* Button */}
        <Button
          className="w-full"
          variant="primary"
          disabled={!isValidSecret || isPending || isConfirming}
          onClick={handleWithdraw}
        >
          {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Confirming...' : 'Withdraw Funds'}
        </Button>

        {/* Warning */}
        <p className="text-xs text-center text-gray-500">
          Warning: The secret will be publicly visible after this transaction. Make sure you have already claimed funds on the other chain if needed.
        </p>
      </div>
    </Card>
  );
}

// Component to display/copy a secret (for the initiator)
export function SecretDisplay({ secret, swapId }: { secret: string; swapId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-yellow-500/20 bg-yellow-500/5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-yellow-400">Save Your Secret</h3>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        Store this secret securely. You will need it to claim your funds on the target chain.
        Do not share this secret until you are ready to complete the swap.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Swap ID</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded bg-gray-800 text-xs font-mono truncate">
              {swapId}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(swapId)}
            >
              Copy
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Secret (Keep Private!)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded bg-gray-800 text-xs font-mono truncate">
              {secret}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(secret)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-red-400">
          Warning: If you lose this secret and the timelock expires, your funds will be returned to the initiator.
          Make sure to save it in a secure location.
        </p>
      </div>
    </Card>
  );
}
