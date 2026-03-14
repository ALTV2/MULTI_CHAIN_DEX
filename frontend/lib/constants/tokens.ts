import { sepolia, polygonAmoy } from 'wagmi/chains';
import { zeroAddress } from 'viem';
import type { Token } from '@/types/token';
import { localEth, localPolygon } from '@/lib/contracts/config';

// Local chain tokens — addresses populated from env by scripts/deploy-local.sh
// Symbols and names are intentionally identical so the UI looks the same in both modes.
const localTokensByChain: Record<number | string, Token[]> = {
  [localEth.id]: [
    {
      address: zeroAddress,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
    },
    {
      address: (process.env.NEXT_PUBLIC_LOCAL_ETH_TEST_TOKEN_A || zeroAddress) as `0x${string}`,
      symbol: 'TKA',
      name: 'Test Token A',
      decimals: 18,
      logoURI: '/tokens/tka.svg',
    },
    {
      address: (process.env.NEXT_PUBLIC_LOCAL_ETH_TEST_TOKEN_B || zeroAddress) as `0x${string}`,
      symbol: 'TKB',
      name: 'Test Token B',
      decimals: 18,
      logoURI: '/tokens/tkb.svg',
    },
  ],
  [localPolygon.id]: [
    {
      address: zeroAddress,
      symbol: 'MATIC',
      name: 'MATIC',
      decimals: 18,
      logoURI: '/tokens/matic.svg',
    },
    {
      address: (process.env.NEXT_PUBLIC_LOCAL_POLYGON_TEST_TOKEN_A || zeroAddress) as `0x${string}`,
      symbol: 'pTka',
      name: 'Polygon Test Token A',
      decimals: 18,
      logoURI: '/tokens/tka.svg',
    },
    {
      address: (process.env.NEXT_PUBLIC_LOCAL_POLYGON_TEST_TOKEN_B || zeroAddress) as `0x${string}`,
      symbol: 'pTkb',
      name: 'Polygon Test Token B',
      decimals: 18,
      logoURI: '/tokens/tkb.svg',
    },
  ],
};

export const tokensByChain: Record<number | string, Token[]> = {
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
    {
      address: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      logoURI: '/tokens/weth.svg',
    },
    {
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
    },
    {
      address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      logoURI: '/tokens/dai.svg',
    },
    {
      address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      logoURI: '/tokens/link.svg',
    },
    {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      logoURI: '/tokens/uni.svg',
    },
    {
      address: '0x29f2D40B0605204364af54EC677bD022dA425d03',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      logoURI: '/tokens/wbtc.svg',
    },
  ],
  [polygonAmoy.id]: [
    {
      address: zeroAddress,
      symbol: 'MATIC',
      name: 'MATIC',
      decimals: 18,
      logoURI: '/tokens/matic.svg',
    },
    {
      address: '0x711F11CfeD1D00f981BdA0E7B892dDa6f2EA47c5',
      symbol: 'pTka',
      name: 'Polygon Test Token A',
      decimals: 18,
      logoURI: '/tokens/tka.svg',
    },
    {
      address: '0xCADe258E49B605cEaCe568A688893589D8E72907',
      symbol: 'pTkb',
      name: 'Polygon Test Token B',
      decimals: 18,
      logoURI: '/tokens/tkb.svg',
    },
    {
      address: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      logoURI: '/tokens/weth.svg',
    },
    {
      address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: '0xcDe3eFE3fC68CCfaF40cF7e5e1eFc01DAecE3C4F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
    },
    {
      address: '0xC9bDA0fa861Bd3A16635e0b7d1e17eB9aC92e1D4',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      logoURI: '/tokens/dai.svg',
    },
    {
      address: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      logoURI: '/tokens/link.svg',
    },
    {
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      symbol: 'AAVE',
      name: 'Aave',
      decimals: 18,
      logoURI: '/tokens/aave.svg',
    },
    {
      address: '0x9c2C5fd7559990A5e28aC3cc861796cb7853B012',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      logoURI: '/tokens/wbtc.svg',
    },
  ],
  'sui:testnet': [
    {
      address: '0x2::sui::SUI',
      symbol: 'SUI',
      name: 'SUI',
      decimals: 9,
      logoURI: '/tokens/sui.svg',
    },
    {
      address: '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_a::TEST_TOKEN_A',
      symbol: 'sTKA',
      name: 'SUI Test Token A',
      decimals: 9,
      logoURI: '/tokens/tka.svg',
    },
    {
      address: '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_b::TEST_TOKEN_B',
      symbol: 'sTKB',
      name: 'SUI Test Token B',
      decimals: 9,
      logoURI: '/tokens/tkb.svg',
    },
  ],
  // Local chain tokens (merged in below)
  ...localTokensByChain,
};

// O(1) lookup index: chainId -> lowercase address -> Token
const tokenIndex: Record<number | string, Record<string, Token>> = {};
for (const [chainId, tokens] of Object.entries(tokensByChain)) {
  const map: Record<string, Token> = {};
  for (const token of tokens) {
    map[token.address.toLowerCase()] = token;
  }
  tokenIndex[chainId] = map;
}

export function getTokensByChainId(chainId: number | string): Token[] {
  return tokensByChain[chainId] || [];
}

export function getTokenByAddress(
  chainId: number | string,
  address: string
): Token | undefined {
  return tokenIndex[chainId]?.[address.toLowerCase()];
}

export function getTokenBySymbol(
  chainId: number | string,
  symbol: string
): Token | undefined {
  const tokens = getTokensByChainId(chainId);
  return tokens.find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function isNativeToken(chainId: number | string, address: string): boolean {
  // EVM chains use zero address for native token
  if (typeof chainId === 'number') {
    return address === zeroAddress;
  }
  // SUI uses special type for native token
  if (typeof chainId === 'string' && chainId.startsWith('sui:')) {
    return address === '0x2::sui::SUI';
  }
  return false;
}
