/**
 * On-chain HTLC verification guards (fixes V-1, V-2, V-9).
 *
 * The cross-chain swap is only safe if each party independently verifies the
 * counterparty's HTLC *on-chain* — never trusting a backend-supplied hashlock /
 * swapId, and never revealing the secret against an unverified swap. The HTLC
 * contract pays a fixed `participant` and accepts an arbitrary swapId, so the
 * only defense against decoy/collision HTLCs lives here, on the client.
 *
 * `status` follows the Solidity enum SwapStatus { Empty=0, Active=1, Withdrawn=2, Refunded=3 }.
 * For SUI legs, normalize get_swap_info() into this same shape before calling.
 */
export interface OnchainHtlc {
  status: number;
  participant: string;
  token: string;
  amount: bigint;
  hashlock: string;
  timelock: bigint;
}

export interface LockExpectation {
  myAddress: string; // where the counterparty HTLC must pay me
  hashlock: string; // the shared hashlock for this swap
  token: string; // the token the counterparty must have locked
  minAmount: bigint; // at least the agreed amount (scaled)
  minTimelock: bigint; // counterparty leg must outlive my leg + safety margin
}

const STATUS_ACTIVE = 1;

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * V-1 / V-9 — call BEFORE locking your own (second) HTLC leg.
 * Throws if the counterparty's on-chain HTLC is not exactly what was agreed.
 */
export function verifyCounterpartyHtlc(s: OnchainHtlc, e: LockExpectation): void {
  if (s.status !== STATUS_ACTIVE) {
    throw new Error('counterparty HTLC is not Active');
  }
  if (!eq(s.participant, e.myAddress)) {
    throw new Error(`counterparty HTLC participant ${s.participant} != me ${e.myAddress}`);
  }
  if (!eq(s.hashlock, e.hashlock)) {
    throw new Error('counterparty HTLC hashlock mismatch');
  }
  if (!eq(s.token, e.token)) {
    throw new Error('counterparty HTLC token mismatch');
  }
  if (s.amount < e.minAmount) {
    throw new Error(`counterparty HTLC amount ${s.amount} < expected ${e.minAmount}`);
  }
  if (s.timelock < e.minTimelock) {
    throw new Error(`counterparty HTLC timelock ${s.timelock} too short (must be >= ${e.minTimelock})`);
  }
}

/**
 * V-2 — call BEFORE revealing the secret via withdraw.
 * Throws if the HTLC you are about to withdraw from does not pay you, is not
 * bound to the expected hashlock, or is no longer Active.
 */
export function assertClaimableByMe(
  s: OnchainHtlc,
  myAddress: string,
  expectedHashlock: string
): void {
  if (s.status !== STATUS_ACTIVE) {
    throw new Error('swap is not Active — refusing to reveal secret');
  }
  if (!eq(s.participant, myAddress)) {
    throw new Error('swap participant is not me — refusing to reveal secret');
  }
  if (!eq(s.hashlock, expectedHashlock)) {
    throw new Error('swap hashlock mismatch — refusing to reveal secret');
  }
}
