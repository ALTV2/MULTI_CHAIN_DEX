import { sepolia, polygonAmoy } from 'wagmi/chains';
import { chainConfig } from '@/lib/contracts/addresses';
import { tokensByChain } from '@/lib/constants/tokens';
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

const sepoliaAdapter = new EvmChainAdapter({
  chainId: sepolia.id,
  name: chainConfig[sepolia.id].name,
  shortName: chainConfig[sepolia.id].shortName,
  nativeCurrency: chainConfig[sepolia.id].nativeCurrency,
  blockExplorer: chainConfig[sepolia.id].blockExplorer,
  color: chainConfig[sepolia.id].color,
  icon: chainConfig[sepolia.id].icon,
  tokens: convertTokens(sepolia.id),
});

const polygonAmoyAdapter = new EvmChainAdapter({
  chainId: polygonAmoy.id,
  name: chainConfig[polygonAmoy.id].name,
  shortName: chainConfig[polygonAmoy.id].shortName,
  nativeCurrency: chainConfig[polygonAmoy.id].nativeCurrency,
  blockExplorer: chainConfig[polygonAmoy.id].blockExplorer,
  color: chainConfig[polygonAmoy.id].color,
  icon: chainConfig[polygonAmoy.id].icon,
  tokens: convertTokens(polygonAmoy.id),
});

chainRegistry.register(String(sepolia.id), sepoliaAdapter);
chainRegistry.register(String(polygonAmoy.id), polygonAmoyAdapter);

export { sepoliaAdapter, polygonAmoyAdapter };
