import { sepolia, polygonAmoy } from 'wagmi/chains';
import { chainConfig } from '@/lib/contracts/addresses';
import { tokensByChain } from '@/lib/constants/tokens';
import { localEth, localPolygon } from '@/lib/contracts/config';
import type { TokenInfo } from '../types';
import { chainRegistry } from '../registry';
import { EvmChainAdapter } from './EvmChainAdapter';

function convertTokens(chainId: number): TokenInfo[] {
  const tokens = tokensByChain[chainId] ?? [];
  return tokens.map((t) => ({
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: t.logoURI,
  }));
}

function makeAdapter(chainId: number) {
  const cfg = (chainConfig as any)[chainId];
  if (!cfg) throw new Error(`No chainConfig for chainId ${chainId}`);
  return new EvmChainAdapter({
    chainId,
    name: cfg.name,
    shortName: cfg.shortName,
    nativeCurrency: cfg.nativeCurrency,
    blockExplorer: cfg.blockExplorer,
    color: cfg.color,
    icon: cfg.icon,
    tokens: convertTokens(chainId),
  });
}

// Register all 4 EVM chain adapters
for (const chainId of [localEth.id, localPolygon.id, sepolia.id, polygonAmoy.id]) {
  chainRegistry.register(String(chainId), makeAdapter(chainId));
}

// Named exports for backward compat
export const sepoliaAdapter     = chainRegistry.get(String(sepolia.id))!;
export const polygonAmoyAdapter = chainRegistry.get(String(polygonAmoy.id))!;
