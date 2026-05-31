import { describe, it, expect } from 'vitest';
import { scaleCrossChainAmount } from './scaling';

/**
 * E-6: cross-chain decimal scaling.
 * Cross-chain orders normalize amounts to 9 decimals (SUI u64-safe).
 * When a matcher fills on an EVM chain, the 9-dec amount must be re-scaled
 * to the EVM token's native decimals — in BOTH directions.
 * The old code `order.buyAmount * BigInt(10 ** (evmDecimals - 9))` throws a
 * RangeError for any token with <9 decimals (USDC=6, USDT=6, WBTC=8).
 */
describe('scaleCrossChainAmount (E-6)', () => {
  it('scales 9-dec up to 18-dec (ETH/most ERC20)', () => {
    expect(scaleCrossChainAmount(1_000_000_000n, 18)).toBe(10n ** 18n);
  });

  it('scales 9-dec DOWN to 6-dec (USDC/USDT) — old code threw RangeError', () => {
    expect(scaleCrossChainAmount(1_000_000_000n, 6)).toBe(1_000_000n);
  });

  it('scales 9-dec DOWN to 8-dec (WBTC)', () => {
    expect(scaleCrossChainAmount(1_000_000_000n, 8)).toBe(100_000_000n);
  });

  it('is identity at exactly 9 decimals', () => {
    expect(scaleCrossChainAmount(123_456_789n, 9)).toBe(123_456_789n);
  });

  it('rejects amounts not representable at the smaller decimal count', () => {
    // 1 unit at 9-dec (1e-9) cannot exist at 6-dec without losing value
    expect(() => scaleCrossChainAmount(1n, 6)).toThrow();
  });

  it('never evaluates BigInt(10 ** negative) (the original bug)', () => {
    // sanity: these calls must not throw a RangeError for sub-9-decimal tokens
    expect(() => scaleCrossChainAmount(5_000_000_000n, 6)).not.toThrow();
  });
});
