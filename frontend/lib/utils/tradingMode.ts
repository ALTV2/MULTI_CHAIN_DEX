export type TradingMode = 'cross-chain' | 'same-chain';

export function getTradingMode(sourceChainId: number, targetChainId: number): TradingMode {
  return sourceChainId === targetChainId ? 'same-chain' : 'cross-chain';
}
