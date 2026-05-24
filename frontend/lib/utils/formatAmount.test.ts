import { describe, it, expect } from 'vitest';
import { formatAmount } from './formatAmount';

describe('formatAmount', () => {
  it('formats SUI-source amounts with 9 decimals regardless of chainId/decimals', () => {
    // SUI source must win even when an EVM chainId and 18 decimals are passed.
    expect(formatAmount(1_000_000_000n, 11155111, 18, 'sui:testnet')).toBe('1');
  });

  it('uses explicit decimals for non-SUI orders', () => {
    expect(formatAmount(1_000_000n, 11155111, 6)).toBe('1');
  });

  it('auto-detects 18 decimals for EVM chains', () => {
    expect(formatAmount(10n ** 18n, 11155111)).toBe('1');
  });

  it('auto-detects 9 decimals for SUI chains', () => {
    expect(formatAmount(10n ** 9n, 'sui:testnet')).toBe('1');
  });

  it('accepts a string amount', () => {
    expect(formatAmount('1000000000000000000', 11155111)).toBe('1');
  });

  it('formats fractional EVM amounts', () => {
    expect(formatAmount(5n * 10n ** 17n, 1)).toBe('0.5');
  });
});
