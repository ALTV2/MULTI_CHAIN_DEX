import type { ChainAdapter, ChainFamily, ChainInfo, TokenInfo } from './types';

class ChainAdapterRegistry {
  private adapters = new Map<string, ChainAdapter>();

  register(chainId: string, adapter: ChainAdapter): void {
    this.adapters.set(chainId, adapter);
  }

  getAdapter(chainId: string | number): ChainAdapter | undefined {
    return this.adapters.get(String(chainId));
  }

  getAllChains(): ChainInfo[] {
    return Array.from(this.adapters.values()).map((a) => a.getChainInfo());
  }

  getChainsByFamily(family: ChainFamily): ChainInfo[] {
    return this.getAllChains().filter((c) => c.family === family);
  }

  getTokens(chainId: string | number): TokenInfo[] {
    return this.getAdapter(chainId)?.getTokens() ?? [];
  }

  isSupported(chainId: string | number): boolean {
    return this.adapters.has(String(chainId));
  }

  getSupportedChainIds(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const chainRegistry = new ChainAdapterRegistry();
