'use client';

import { useMemo } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { TokenIcon } from '@/components/common/TokenIcon';
import { getSupportedChainIds, getChainConfig } from '@/lib/contracts/addresses';
import { getTokensByChainId } from '@/lib/constants/tokens';
import { useTranslation } from '@/hooks/useTranslation';

interface ChainPairSelectorProps {
  sourceChainId: number | string;
  targetChainId: number | string;
  sourceToken: string;
  targetToken: string;
  onSourceChainChange: (chainId: number | string) => void;
  onTargetChainChange: (chainId: number | string) => void;
  onSourceTokenChange: (address: string) => void;
  onTargetTokenChange: (address: string) => void;
}

export function ChainPairSelector({
  sourceChainId,
  targetChainId,
  sourceToken,
  targetToken,
  onSourceChainChange,
  onTargetChainChange,
  onSourceTokenChange,
  onTargetTokenChange,
}: ChainPairSelectorProps) {
  const chainIds = getSupportedChainIds();
  const { t } = useTranslation();

  const chainOptions = useMemo<SelectOption<string>[]>(
    () =>
      chainIds.map((id) => {
        const config = getChainConfig(id);
        return {
          value: String(id),
          label: config?.shortName ?? `Chain ${id}`,
          icon: (
            <img src={config?.icon || ''} alt="" className="w-5 h-5 flex-shrink-0 rounded-full" />
          ),
        };
      }),
    [chainIds]
  );

  const sourceTokens = useMemo<SelectOption<string>[]>(() => {
    return getTokensByChainId(sourceChainId).map((token) => ({
      value: token.address,
      label: token.symbol,
      description: token.name,
      icon: <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />,
    }));
  }, [sourceChainId]);

  const targetTokens = useMemo<SelectOption<string>[]>(() => {
    return getTokensByChainId(targetChainId).map((token) => ({
      value: token.address,
      label: token.symbol,
      description: token.name,
      icon: <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />,
    }));
  }, [targetChainId]);

  function handleSwap() {
    const tmpChain = sourceChainId;
    const tmpToken = sourceToken;
    onSourceChainChange(targetChainId);
    onTargetChainChange(tmpChain);
    onSourceTokenChange(targetToken);
    onTargetTokenChange(tmpToken);
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-3">
      {/* Source */}
      <div className="flex items-center gap-2 flex-1 w-full">
        <Select
          value={String(sourceChainId)}
          onChange={(v) => {
            // Check if value is numeric or string chainId
            const chainId = v.includes(':') ? v : Number(v);
            onSourceChainChange(chainId);
          }}
          options={chainOptions}
          label={t('chainPair.fromChain')}
          className="flex-1"
        />
        <Select
          value={sourceToken}
          onChange={onSourceTokenChange}
          options={sourceTokens}
          label={t('chainPair.token')}
          searchable
          allowCustom
          className="flex-1"
        />
      </div>

      {/* Swap button */}
      <button
        type="button"
        onClick={handleSwap}
        className="mt-6 p-2.5 rounded-xl bg-light-hover dark:bg-dark-hover border border-light-border dark:border-dark-border hover:bg-accent-blue/10 hover:border-accent-blue/20 transition-all group"
        title={t('chainPair.swap')}
      >
        <svg
          className="w-5 h-5 text-gray-400 group-hover:text-accent-blue transition-colors md:rotate-0 rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </button>

      {/* Target */}
      <div className="flex items-center gap-2 flex-1 w-full">
        <Select
          value={String(targetChainId)}
          onChange={(v) => {
            // Check if value is numeric or string chainId
            const chainId = v.includes(':') ? v : Number(v);
            onTargetChainChange(chainId);
          }}
          options={chainOptions}
          label={t('chainPair.toChain')}
          className="flex-1"
        />
        <Select
          value={targetToken}
          onChange={onTargetTokenChange}
          options={targetTokens}
          label={t('chainPair.token')}
          searchable
          allowCustom
          className="flex-1"
        />
      </div>
    </div>
  );
}
