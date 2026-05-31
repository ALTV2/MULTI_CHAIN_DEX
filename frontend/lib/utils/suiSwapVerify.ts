/**
 * V-2 (SUI side): fail-closed verification of a SUI HTLC Swap object before a party reveals the
 * secret by withdrawing it. The SUI Move `withdraw` already enforces sender==participant and
 * secret==hashlock on-chain, but that check runs only AFTER the secret is submitted in a tx —
 * a same-hashlock decoy paying the victim a dust balance could still induce a premature reveal.
 * This mirrors assertClaimableByMe on the EVM legs (see htlcVerify.ts).
 */

export const SUI_STATUS_ACTIVE = 1;

export interface SuiOnchainSwap {
  status: number; // 1=Active, 2=Withdrawn, 3=Refunded
  participant: string;
  /** Normalized 0x-hex, or null if it could not be parsed from the object. */
  hashlock: string | null;
  amount: bigint;
}

export interface SuiClaimExpectation {
  mySuiAddress: string;
  expectedHashlock: string;
  minAmount?: bigint;
}

/** Normalize a SUI address to a lowercase, 32-byte-padded 0x string for comparison. */
export function normalizeSuiAddr(a: string): string {
  return ('0x' + (a || '').replace(/^0x/, '').padStart(64, '0')).toLowerCase();
}

/** A Move vector<u8> read via getObject can be a number[] or a hex string; normalize to 0x-hex. */
export function normalizeSuiHashlock(h: unknown): string | null {
  if (h == null) return null;
  if (Array.isArray(h)) {
    return ('0x' + h.map((b) => (Number(b) & 0xff).toString(16).padStart(2, '0')).join('')).toLowerCase();
  }
  if (typeof h === 'string') return (h.startsWith('0x') ? h : '0x' + h).toLowerCase();
  return null;
}

/**
 * Throws if the SUI swap is not safely claimable by me. Lenient ONLY on an unparseable object
 * hashlock (null) — the on-chain Move contract still enforces secret==hashlock there.
 */
export function assertSuiClaimableByMe(swap: SuiOnchainSwap, expect: SuiClaimExpectation): void {
  if (swap.status !== SUI_STATUS_ACTIVE) {
    throw new Error('SUI HTLC is not active — refusing to reveal secret');
  }
  if (normalizeSuiAddr(swap.participant) !== normalizeSuiAddr(expect.mySuiAddress)) {
    throw new Error('SUI HTLC does not pay this wallet — refusing to reveal secret');
  }
  if (swap.hashlock && swap.hashlock !== expect.expectedHashlock.toLowerCase()) {
    throw new Error('SUI HTLC hashlock mismatch — refusing to reveal secret (possible decoy)');
  }
  if (swap.amount <= 0n) {
    throw new Error('SUI HTLC holds no balance — refusing to reveal secret (possible decoy)');
  }
  if (expect.minAmount != null && swap.amount < expect.minAmount) {
    throw new Error('SUI HTLC amount below expected — refusing to reveal secret (possible decoy)');
  }
}
