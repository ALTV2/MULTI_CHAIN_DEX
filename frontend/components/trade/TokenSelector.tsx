'use client';

import { useState, useRef, useEffect } from 'react';
import { useChainId } from 'wagmi';
import { getTokensByChainId } from '@/lib/constants/tokens';
import { TokenIcon } from '@/components/common/TokenIcon';
import { cn } from '@/lib/utils/cn';
import type { Token } from '@/types/token';

interface TokenSelectorProps {
  selectedToken: Token | undefined;
  onSelectToken: (token: Token) => void;
  excludeToken?: Token;
  label?: string;
}

export function TokenSelector({
  selectedToken,
  onSelectToken,
  excludeToken,
  label,
}: TokenSelectorProps) {
  const chainId = useChainId();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tokens = getTokensByChainId(chainId).filter(
    (token) => token.address !== excludeToken?.address
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectToken = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-4 py-3 rounded-xl',
          'bg-light-hover dark:bg-dark-hover',
          'border border-light-border dark:border-dark-border',
          'text-left',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue',
          'transition-all duration-200',
          'flex items-center justify-between'
        )}
      >
        {selectedToken ? (
          <div className="flex items-center gap-3">
            <TokenIcon token={selectedToken} size="sm" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {selectedToken.symbol}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {selectedToken.name}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">
            Select token
          </span>
        )}
        <svg
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-xl max-h-64 overflow-y-auto">
          {tokens.map((token) => (
            <button
              key={token.address}
              type="button"
              onClick={() => handleSelectToken(token)}
              className={cn(
                'w-full px-4 py-3 flex items-center gap-3',
                'hover:bg-light-hover dark:hover:bg-dark-hover',
                'transition-colors duration-150',
                'first:rounded-t-xl last:rounded-b-xl',
                selectedToken?.address === token.address &&
                  'bg-accent-blue/10'
              )}
            >
              <TokenIcon token={token} size="sm" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-white">
                  {token.symbol}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {token.name}
                </div>
              </div>
              {selectedToken?.address === token.address && (
                <svg
                  className="w-5 h-5 text-accent-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
