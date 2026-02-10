import { isAddress, getAddress } from 'viem';
import type { ChainAdapter, ChainInfo, TokenInfo } from '../types';

interface EvmChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorer: string;
  color: string;
  icon: string;
  tokens: TokenInfo[];
}

export class EvmChainAdapter implements ChainAdapter {
  private config: EvmChainConfig;

  constructor(config: EvmChainConfig) {
    this.config = config;
  }

  getChainInfo(): ChainInfo {
    return {
      id: String(this.config.chainId),
      numericId: this.config.chainId,
      name: this.config.name,
      shortName: this.config.shortName,
      family: 'evm',
      nativeCurrency: this.config.nativeCurrency,
      blockExplorer: this.config.blockExplorer,
      color: this.config.color,
      icon: this.config.icon,
    };
  }

  getTokens(): TokenInfo[] {
    return this.config.tokens;
  }

  formatAddress(address: string): string {
    try {
      return getAddress(address);
    } catch {
      return address;
    }
  }

  truncateAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  isValidAddress(address: string): boolean {
    return isAddress(address);
  }

  getExplorerTxUrl(txHash: string): string {
    return `${this.config.blockExplorer}/tx/${txHash}`;
  }

  getExplorerAddressUrl(address: string): string {
    return `${this.config.blockExplorer}/address/${address}`;
  }
}
