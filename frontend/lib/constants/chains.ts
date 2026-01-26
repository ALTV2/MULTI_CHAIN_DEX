import { sepolia } from 'wagmi/chains';

export const supportedChains = [sepolia] as const;

export const defaultChain = sepolia;

export type SupportedChain = (typeof supportedChains)[number];

export function getChainName(chainId: number): string {
  const chain = supportedChains.find((c) => c.id === chainId);
  return chain?.name || 'Unknown';
}

export function getBlockExplorerUrl(chainId: number): string {
  const chain = supportedChains.find((c) => c.id === chainId);
  return chain?.blockExplorers?.default.url || '';
}

export function getBlockExplorerTxUrl(chainId: number, txHash: string): string {
  const baseUrl = getBlockExplorerUrl(chainId);
  return baseUrl ? `${baseUrl}/tx/${txHash}` : '';
}

export function getBlockExplorerAddressUrl(
  chainId: number,
  address: string
): string {
  const baseUrl = getBlockExplorerUrl(chainId);
  return baseUrl ? `${baseUrl}/address/${address}` : '';
}
