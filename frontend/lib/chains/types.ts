export type ChainFamily = 'evm' | 'sui' | 'solana' | 'ton';

export interface ChainInfo {
  id: string;
  numericId?: number;
  name: string;
  shortName: string;
  family: ChainFamily;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  color: string;
  icon: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

export interface ChainAdapter {
  getChainInfo(): ChainInfo;
  getTokens(): TokenInfo[];
  formatAddress(address: string): string;
  truncateAddress(address: string): string;
  isValidAddress(address: string): boolean;
  getExplorerTxUrl(txHash: string): string;
  getExplorerAddressUrl(address: string): string;
}
