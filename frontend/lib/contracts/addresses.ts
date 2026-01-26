import { sepolia } from 'wagmi/chains';

export const contractAddresses = {
  [sepolia.id]: {
    tokenManager: '0x7cDA5b87638d483F9621E658Cd8d5873bE698eb5' as const,
    orderBook: '0x96c763c1Cb33e5be34c20980570Fe1614F3df05e' as const,
    trade: '0x125B8201BFB93337b298Dc650F9729a2aa7E2061' as const,
    testTokenA: '0x16eb4f1a13dC130074360a14ec5ee01632e87584' as const,
    testTokenB: '0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644' as const,
  },
} as const;

export type SupportedChainId = keyof typeof contractAddresses;

export function getContractAddress(
  chainId: number,
  contract: keyof (typeof contractAddresses)[typeof sepolia.id]
): `0x${string}` {
  const addresses = contractAddresses[chainId as SupportedChainId];
  if (!addresses) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  return addresses[contract];
}

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in contractAddresses;
}
