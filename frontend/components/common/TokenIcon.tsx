'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Token } from '@/types/token';

interface TokenIconProps {
  token?: Token;
  symbol?: string;
  logoURI?: string;
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 48,
};

export function TokenIcon({
  token,
  symbol: propSymbol,
  logoURI: propLogoURI,
  size = 32,
  className = ''
}: TokenIconProps) {
  const [imageError, setImageError] = useState(false);

  const symbol = token?.symbol || propSymbol || '?';
  const logoURI = token?.logoURI || propLogoURI || '';

  // Convert size to number
  const numericSize = typeof size === 'string' ? sizeMap[size] : size;

  if (imageError || !logoURI) {
    const gradients: Record<string, string> = {
      ETH: 'from-blue-500 to-purple-600',
      TKA: 'from-green-500 to-teal-600',
      TKB: 'from-orange-500 to-red-600',
    };

    const gradient = gradients[symbol] || 'from-gray-500 to-gray-700';

    return (
      <div
        className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold ${className}`}
        style={{ width: numericSize, height: numericSize, fontSize: numericSize * 0.4 }}
      >
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: numericSize, height: numericSize }}>
      <Image
        src={logoURI}
        alt={symbol}
        width={numericSize}
        height={numericSize}
        className="rounded-full"
        onError={() => setImageError(true)}
      />
    </div>
  );
}
