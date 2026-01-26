import { sepolia } from 'wagmi/chains';
import { zeroAddress } from 'viem';
import type { Token } from '@/types/token';

export const tokensByChain: Record<number, Token[]> = {
  [sepolia.id]: [
    {
      address: zeroAddress,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
    },
    {
      address: '0x16eb4f1a13dC130074360a14ec5ee01632e87584',
      symbol: 'TKA',
      name: 'Test Token A',
      decimals: 18,
      logoURI: '/tokens/tka.svg',
    },
    {
      address: '0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644',
      symbol: 'TKB',
      name: 'Test Token B',
      decimals: 18,
      logoURI: '/tokens/tkb.svg',
    },
  ],
};

export function getTokensByChainId(chainId: number): Token[] {
  return tokensByChain[chainId] || [];
}

export function getTokenByAddress(
  chainId: number,
  address: `0x${string}`
): Token | undefined {
  const tokens = getTokensByChainId(chainId);
  return tokens.find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenBySymbol(
  chainId: number,
  symbol: string
): Token | undefined {
  const tokens = getTokensByChainId(chainId);
  return tokens.find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function isNativeToken(address: `0x${string}`): boolean {
  return address === zeroAddress;
}
