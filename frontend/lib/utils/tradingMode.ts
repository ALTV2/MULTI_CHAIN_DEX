export type TradingMode = 'cross-chain' | 'same-chain';

export function getTradingMode(sourceChainId: number | string, targetChainId: number | string): TradingMode {
  return sourceChainId === targetChainId ? 'same-chain' : 'cross-chain';
}
