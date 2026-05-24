import { describe, it, expect } from 'vitest';
import { getTradingMode } from './tradingMode';

describe('getTradingMode', () => {
  it('returns same-chain when source equals target', () => {
    expect(getTradingMode(11155111, 11155111)).toBe('same-chain');
    expect(getTradingMode('sui:testnet', 'sui:testnet')).toBe('same-chain');
  });
  it('returns cross-chain when they differ', () => {
    expect(getTradingMode(11155111, 80002)).toBe('cross-chain');
    expect(getTradingMode(11155111, 'sui:testnet')).toBe('cross-chain');
  });
});
