'use client';

import { useState } from 'react';
import { formatAddress } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

interface AddressDisplayProps {
  address: string;
  chars?: number;
  className?: string;
  showCopy?: boolean;
}

export function AddressDisplay({
  address,
  chars = 4,
  className,
  showCopy = true,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      className={cn(
        'font-mono text-sm inline-flex items-center gap-1.5',
        showCopy && 'cursor-pointer hover:text-accent-blue',
        className
      )}
      onClick={showCopy ? handleCopy : undefined}
      title={address}
    >
      {formatAddress(address, chars)}
      {showCopy && (
        <span className="text-xs">
          {copied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-green"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-50"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </span>
      )}
    </span>
  );
}
