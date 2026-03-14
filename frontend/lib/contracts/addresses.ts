import { sepolia, polygonAmoy } from 'wagmi/chains';
import { localEth, localPolygon } from './config';

// ─── Testnet addresses (hardcoded) ────────────────────────────────────────────
const testnetAddresses = {
  [sepolia.id]: {
    tokenManager:        '0x7cDA5b87638d483F9621E658Cd8d5873bE698eb5',
    orderBook:           '0x96c763c1Cb33e5be34c20980570Fe1614F3df05e',
    trade:               '0x125B8201BFB93337b298Dc650F9729a2aa7E2061',
    htlc:                '0x9aB954f470cc7196C0803bE44b1d58e762a48964',
    crossChainOrderBook: '0x6A78740f7D35818D30e23ebD5A5880A1836aa445',
    testTokenA:          '0x16eb4f1a13dC130074360a14ec5ee01632e87584',
    testTokenB:          '0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644',
  },
  [polygonAmoy.id]: {
    tokenManager:        '0x3241Fc31fe186660d467DDb1c841EAA7ecaea6C1',
    orderBook:           '0x22763589e1dd35d1FE86c51B0593E71677d72054',
    trade:               '0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5',
    htlc:                '0x3d857Fc3510246A050817C29ea7C434ab7EbA81A',
    crossChainOrderBook: '0x5F08Ec67A95C4394d577c90c65083AEb119BD922',
    testTokenA:          '0x711F11CfeD1D00f981BdA0E7B892dDa6f2EA47c5',
    testTokenB:          '0xCADe258E49B605cEaCe568A688893589D8E72907',
  },
  'sui:testnet': {
    htlc:                '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96',
    crossChainOrderBook: '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0',
    orderBook:           '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0',
    trade:               '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0',
    testTokenA:          '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_a::TEST_TOKEN_A',
    testTokenB:          '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_b::TEST_TOKEN_B',
  },
} as const;

// ─── Local addresses (populated by scripts/deploy-local.sh via .env.local) ───
// All values are '' until deploy-local.sh runs and generate-local-env.js writes them.
const localAddresses = {
  [localEth.id]: {
    tokenManager:        process.env.NEXT_PUBLIC_LOCAL_ETH_TOKEN_MANAGER          || '',
    orderBook:           process.env.NEXT_PUBLIC_LOCAL_ETH_ORDER_BOOK             || '',
    trade:               process.env.NEXT_PUBLIC_LOCAL_ETH_TRADE                  || '',
    htlc:                process.env.NEXT_PUBLIC_LOCAL_ETH_HTLC                   || '',
    crossChainOrderBook: process.env.NEXT_PUBLIC_LOCAL_ETH_CROSS_CHAIN_ORDER_BOOK || '',
    testTokenA:          process.env.NEXT_PUBLIC_LOCAL_ETH_TEST_TOKEN_A           || '',
    testTokenB:          process.env.NEXT_PUBLIC_LOCAL_ETH_TEST_TOKEN_B           || '',
  },
  [localPolygon.id]: {
    tokenManager:        process.env.NEXT_PUBLIC_LOCAL_POLYGON_TOKEN_MANAGER          || '',
    orderBook:           process.env.NEXT_PUBLIC_LOCAL_POLYGON_ORDER_BOOK             || '',
    trade:               process.env.NEXT_PUBLIC_LOCAL_POLYGON_TRADE                  || '',
    htlc:                process.env.NEXT_PUBLIC_LOCAL_POLYGON_HTLC                   || '',
    crossChainOrderBook: process.env.NEXT_PUBLIC_LOCAL_POLYGON_CROSS_CHAIN_ORDER_BOOK || '',
    testTokenA:          process.env.NEXT_PUBLIC_LOCAL_POLYGON_TEST_TOKEN_A           || '',
    testTokenB:          process.env.NEXT_PUBLIC_LOCAL_POLYGON_TEST_TOKEN_B           || '',
  },
  // SUI always uses testnet — no local node (arm64 incompatibility with mysten/sui-tools image)
  'sui:testnet': testnetAddresses['sui:testnet'],
};

// ─── Active address map — all chains always available ─────────────────────────
export const contractAddresses = {
  ...testnetAddresses,
  ...localAddresses,
};

// ─── Chain metadata ───────────────────────────────────────────────────────────
const testnetChainConfig = {
  [sepolia.id]: {
    name: 'Ethereum (Sepolia)',
    shortName: 'Ethereum',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://sepolia.etherscan.io',
    color: '#627EEA',
    icon: '/chains/ethereum.svg',
  },
  [polygonAmoy.id]: {
    name: 'Polygon (Amoy)',
    shortName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorer: 'https://amoy.polygonscan.com',
    color: '#8247E5',
    icon: '/chains/polygon.svg',
  },
  'sui:testnet': {
    name: 'SUI (Testnet)',
    shortName: 'SUI',
    nativeCurrency: { name: 'SUI', symbol: 'SUI', decimals: 9 },
    blockExplorer: 'https://suiexplorer.com',
    color: '#4DA2FF',
    icon: '/chains/sui.svg',
    type: 'sui' as const,
  },
} as const;

const localChainConfig = {
  [localEth.id]: {
    name: 'Local Ethereum',
    shortName: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: '',
    color: '#627EEA',
    icon: '/chains/ethereum.svg',
  },
  [localPolygon.id]: {
    name: 'Local Polygon',
    shortName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorer: '',
    color: '#8247E5',
    icon: '/chains/polygon.svg',
  },
  // SUI always uses testnet
  'sui:testnet': testnetChainConfig['sui:testnet'],
} as const;

// ─── All chain configs merged ─────────────────────────────────────────────────
export const chainConfig = {
  ...testnetChainConfig,
  ...localChainConfig,
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type SupportedChainId = keyof typeof contractAddresses;
export type ContractName = keyof (typeof testnetAddresses)[typeof sepolia.id];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getContractAddress(
  chainId: number | string,
  contract: ContractName
): string {
  const addresses = (contractAddresses as any)[chainId];
  if (!addresses) throw new Error(`Chain ${chainId} not supported`);
  const address = addresses[contract];
  if (!address) throw new Error(`Contract ${contract} not deployed on chain ${chainId}`);
  return address;
}

export function isSupportedChain(chainId: number | string): boolean {
  return chainId in contractAddresses;
}

export function getChainConfig(chainId: number | string) {
  return (chainConfig as any)[chainId];
}

export function getSupportedChainIds(): (number | string)[] {
  return Object.keys(contractAddresses).map(k => (isNaN(Number(k)) ? k : Number(k)));
}

export function getExplorerTxUrl(chainId: number | string, txHash: string): string {
  const cfg = (chainConfig as any)[chainId];
  if (!cfg?.blockExplorer) return '';
  if (typeof chainId === 'string' && chainId.startsWith('sui:')) {
    const network = chainId === 'sui:local' ? 'localnet' : 'testnet';
    return `${cfg.blockExplorer}/txblock/${txHash}?network=${network}`;
  }
  return `${cfg.blockExplorer}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number | string, address: string): string {
  const cfg = (chainConfig as any)[chainId];
  if (!cfg?.blockExplorer) return '';
  if (typeof chainId === 'string' && chainId.startsWith('sui:')) {
    const network = chainId === 'sui:local' ? 'localnet' : 'testnet';
    return `${cfg.blockExplorer}/address/${address}?network=${network}`;
  }
  return `${cfg.blockExplorer}/address/${address}`;
}
