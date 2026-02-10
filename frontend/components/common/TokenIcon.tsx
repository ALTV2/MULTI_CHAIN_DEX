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

const gradients: Record<string, string> = {
  ETH: 'from-blue-500 to-purple-600',
  WETH: 'from-blue-400 to-indigo-600',
  TKA: 'from-green-500 to-teal-600',
  TKB: 'from-orange-500 to-red-600',
  MATIC: 'from-purple-500 to-violet-700',
  USDT: 'from-emerald-500 to-green-700',
  USDC: 'from-blue-500 to-sky-700',
  DAI: 'from-amber-400 to-yellow-600',
  WBTC: 'from-orange-400 to-amber-700',
  LINK: 'from-blue-600 to-indigo-800',
  UNI: 'from-pink-500 to-rose-700',
  AAVE: 'from-purple-400 to-fuchsia-700',
  pTka: 'from-green-500 to-teal-600',
  pTkb: 'from-orange-500 to-red-600',
  '?': 'from-gray-400 to-gray-600',
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

  const numericSize = typeof size === 'string' ? sizeMap[size] : size;

  if (imageError || !logoURI) {
    const gradient = gradients[symbol] || gradients['?'] || 'from-gray-500 to-gray-700';

    return (
      <div
        className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
        style={{ width: numericSize, height: numericSize, fontSize: numericSize * 0.4 }}
      >
        {symbol === '?' ? '?' : symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: numericSize, height: numericSize }}>
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
