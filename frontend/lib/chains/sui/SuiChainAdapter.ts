import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import type { ChainAdapter, ChainInfo, TokenInfo } from '../types';
import { tokensByChain } from '@/lib/constants/tokens';

const CHAIN_ID = 'sui:testnet';

const EXPLORER_BASE = 'https://suiscan.xyz/testnet';

export class SuiChainAdapter implements ChainAdapter {
  getChainInfo(): ChainInfo {
    return {
      id: CHAIN_ID,
      name: 'SUI (Testnet)',
      shortName: 'SUI',
      family: 'sui',
      nativeCurrency: { name: 'SUI', symbol: 'SUI', decimals: 9 },
      blockExplorer: EXPLORER_BASE,
      color: '#4DA2FF',
      icon: '/chains/sui.svg',
    };
  }

  getTokens(): TokenInfo[] {
    const tokens = tokensByChain[CHAIN_ID] ?? [];
    return tokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoURI: t.logoURI,
    }));
  }

  formatAddress(address: string): string {
    try {
      return normalizeSuiAddress(address);
    } catch {
      return address;
    }
  }

  truncateAddress(address: string): string {
    // SUI addresses are 66 chars (0x + 64 hex). Show 8 + ... + 6
    if (address.length <= 14) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  isValidAddress(address: string): boolean {
    return isValidSuiAddress(address);
  }

  getExplorerTxUrl(txHash: string): string {
    return `${EXPLORER_BASE}/tx/${txHash}`;
  }

  getExplorerAddressUrl(address: string): string {
    return `${EXPLORER_BASE}/account/${address}`;
  }
}
