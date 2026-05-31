/**
 * ERC20 approval policy (C-APPROVE fix).
 *
 * Returns the exact allowance to grant for a swap. The previous implementation
 * approved `maxUint256`, leaving a permanent unbounded allowance on the HTLC
 * contract that a compromised frontend (XSS / malicious dependency) or a future
 * contract bug could drain. We approve exactly what the swap requires so no
 * standing allowance survives the swap.
 */
export function computeApprovalAmount(required: bigint): bigint {
  if (required <= 0n) {
    throw new Error(`approval amount must be positive, got ${required}`);
  }
  return required;
}
