import { describe, it, expect } from 'vitest';
import { maxUint256 } from 'viem';
import { computeApprovalAmount } from './approval';

/**
 * C-APPROVE: ERC20 approvals must be scoped to the exact amount the swap needs,
 * never an unbounded maxUint256 standing allowance (which a compromised frontend
 * or future contract bug could drain). This guards against regressing back to
 * infinite approval.
 */
describe('computeApprovalAmount (C-APPROVE)', () => {
  it('approves exactly the required amount', () => {
    expect(computeApprovalAmount(500n)).toBe(500n);
    expect(computeApprovalAmount(10n ** 18n)).toBe(10n ** 18n);
  });

  it('NEVER returns an unbounded (maxUint256) allowance', () => {
    expect(computeApprovalAmount(500n)).not.toBe(maxUint256);
    expect(computeApprovalAmount(10n ** 30n)).not.toBe(maxUint256);
  });

  it('rejects non-positive amounts', () => {
    expect(() => computeApprovalAmount(0n)).toThrow();
    expect(() => computeApprovalAmount(-1n)).toThrow();
  });
});
