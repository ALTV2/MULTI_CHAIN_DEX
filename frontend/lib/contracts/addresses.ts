import { sepolia, polygonAmoy } from 'wagmi/chains';

// Chain configuration with contract addresses
export const contractAddresses = {
  [sepolia.id]: {
    // Core DEX contracts
    tokenManager: '0x7cDA5b87638d483F9621E658Cd8d5873bE698eb5' as const,
    orderBook: '0x96c763c1Cb33e5be34c20980570Fe1614F3df05e' as const,
    trade: '0x125B8201BFB93337b298Dc650F9729a2aa7E2061' as const,
    // HTLC contracts
    htlc: '0x9aB954f470cc7196C0803bE44b1d58e762a48964' as const,
    crossChainOrderBook: '0x6A78740f7D35818D30e23ebD5A5880A1836aa445' as const,
    // Test tokens
    testTokenA: '0x16eb4f1a13dC130074360a14ec5ee01632e87584' as const,
    testTokenB: '0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644' as const,
  },
  [polygonAmoy.id]: {
    // Core DEX contracts
    tokenManager: '0x3241Fc31fe186660d467DDb1c841EAA7ecaea6C1' as const,
    orderBook: '0x22763589e1dd35d1FE86c51B0593E71677d72054' as const,
    trade: '0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5' as const,
    // HTLC contracts
    htlc: '0x3d857Fc3510246A050817C29ea7C434ab7EbA81A' as const,
    crossChainOrderBook: '0x5F08Ec67A95C4394d577c90c65083AEb119BD922' as const,
    // Test tokens
    testTokenA: '0x711F11CfeD1D00f981BdA0E7B892dDa6f2EA47c5' as const,
    testTokenB: '0xCADe258E49B605cEaCe568A688893589D8E72907' as const,
  },
  // SUI Testnet
  'sui:testnet': {
    // Package ID (used for all modules)
    htlc: '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96' as const,
    crossChainOrderBook: '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0' as const,
    orderBook: '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0' as const,
    trade: '0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0' as const,
    // Test tokens (full type names for SUI)
    testTokenA: '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_a::TEST_TOKEN_A' as const,
    testTokenB: '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_b::TEST_TOKEN_B' as const,
    // Same-chain OrderBookPair shared objects
    orderBookPairTKATKB: '0xdf19c18b4fc74ee7f4d2a407cb6e3ad4758332e2d46c6be3c33796e2aa7dd797' as const,
    orderBookPairTKBTKA: '0x8079033f69fe176c0e04f0cfc3da841c67dda803a38f7f71c3a8fb318047e876' as const,
  },
} as const;

// Chain metadata
export const chainConfig = {
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

export type SupportedChainId = keyof typeof contractAddresses;
export type ContractName = keyof (typeof contractAddresses)[typeof sepolia.id];

export function getContractAddress(
  chainId: number | string,
  contract: ContractName
): string {
  const addresses = contractAddresses[chainId as SupportedChainId];
  if (!addresses) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  const address = (addresses as any)[contract];
  if (!address) {
    throw new Error(`Contract ${contract} not deployed on chain ${chainId}`);
  }
  return address;
}

export function isSupportedChain(chainId: number | string): chainId is SupportedChainId {
  return chainId in contractAddresses;
}

export function getChainConfig(chainId: number | string) {
  return chainConfig[chainId as SupportedChainId];
}

export function getSupportedChainIds(): SupportedChainId[] {
  return Object.keys(contractAddresses) as SupportedChainId[];
}

export function getExplorerTxUrl(chainId: number | string, txHash: string): string {
  const config = chainConfig[chainId as SupportedChainId];
  if (!config) return '';
  if (typeof chainId === 'string' && chainId.startsWith('sui:')) {
    // SUI explorer uses /txblock/ instead of /tx/
    return `${config.blockExplorer}/txblock/${txHash}?network=testnet`;
  }
  return `${config.blockExplorer}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number | string, address: string): string {
  const config = chainConfig[chainId as SupportedChainId];
  if (!config) return '';
  if (typeof chainId === 'string' && chainId.startsWith('sui:')) {
    return `${config.blockExplorer}/address/${address}?network=testnet`;
  }
  return `${config.blockExplorer}/address/${address}`;
}
