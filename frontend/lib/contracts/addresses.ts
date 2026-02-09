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
} as const;

// Chain metadata
export const chainConfig = {
  [sepolia.id]: {
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://sepolia.etherscan.io',
    color: '#627EEA',
    icon: '/chains/ethereum.svg',
  },
  [polygonAmoy.id]: {
    name: 'Polygon Amoy',
    shortName: 'Amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorer: 'https://amoy.polygonscan.com',
    color: '#8247E5',
    icon: '/chains/polygon.svg',
  },
} as const;

export type SupportedChainId = keyof typeof contractAddresses;
export type ContractName = keyof (typeof contractAddresses)[typeof sepolia.id];

export function getContractAddress(
  chainId: number,
  contract: ContractName
): `0x${string}` {
  const addresses = contractAddresses[chainId as SupportedChainId];
  if (!addresses) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  const address = addresses[contract];
  if (!address) {
    throw new Error(`Contract ${contract} not deployed on chain ${chainId}`);
  }
  return address;
}

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in contractAddresses;
}

export function getChainConfig(chainId: number) {
  return chainConfig[chainId as SupportedChainId];
}

export function getSupportedChainIds(): SupportedChainId[] {
  return Object.keys(contractAddresses).map(Number) as SupportedChainId[];
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const config = chainConfig[chainId as SupportedChainId];
  if (!config) return '';
  return `${config.blockExplorer}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  const config = chainConfig[chainId as SupportedChainId];
  if (!config) return '';
  return `${config.blockExplorer}/address/${address}`;
}
