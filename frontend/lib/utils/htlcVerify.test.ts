import { describe, it, expect } from 'vitest';
import {
  verifyCounterpartyHtlc,
  assertClaimableByMe,
  type OnchainHtlc,
} from './htlcVerify';

const ME = '0x1111111111111111111111111111111111111111';
const ATTACKER = '0x2222222222222222222222222222222222222222';
const H = '0xaaaa000000000000000000000000000000000000000000000000000000000000';
const TOKEN = '0x3333333333333333333333333333333333333333';

const goodSwap: OnchainHtlc = {
  status: 1, // Active
  participant: ME,
  token: TOKEN,
  amount: 1000n,
  hashlock: H,
  timelock: 2_000_000_000n,
};

const expectation = {
  myAddress: ME,
  hashlock: H,
  token: TOKEN,
  minAmount: 1000n,
  minTimelock: 1_000_000_000n,
};

/**
 * V-1 / V-9: before locking the second HTLC leg (or trusting a backend-supplied
 * hashlock/swapId), the party MUST read the counterparty's on-chain HTLC and
 * verify it actually pays them, matches the agreed token/amount/hashlock, and
 * outlives their own leg. Otherwise a malicious counterparty (or poisoned
 * backend / decoy HTLC) can induce them to lock funds they will never recover.
 */
describe('verifyCounterpartyHtlc (V-1/V-9 — before locking)', () => {
  it('passes for a correct counterparty HTLC', () => {
    expect(() => verifyCounterpartyHtlc(goodSwap, expectation)).not.toThrow();
  });
  it('rejects a decoy HTLC that pays someone else', () => {
    expect(() => verifyCounterpartyHtlc({ ...goodSwap, participant: ATTACKER }, expectation)).toThrow(/participant/i);
  });
  it('rejects a hashlock mismatch (backend-supplied / collision)', () => {
    expect(() => verifyCounterpartyHtlc({ ...goodSwap, hashlock: '0xdead000000000000000000000000000000000000000000000000000000000000' }, expectation)).toThrow(/hashlock/i);
  });
  it('rejects a wrong token', () => {
    expect(() => verifyCounterpartyHtlc({ ...goodSwap, token: ATTACKER }, expectation)).toThrow(/token/i);
  });
  it('rejects an under-funded amount', () => {
    expect(() => verifyCounterpartyHtlc({ ...goodSwap, amount: 1n }, expectation)).toThrow(/amount/i);
  });
  it('rejects a too-short timelock (must outlive my leg)', () => {
    expect(() => verifyCounterpartyHtlc({ ...goodSwap, timelock: 999_999_999n }, expectation)).toThrow(/timelock/i);
  });
  it('rejects a non-active swap', () => {
    expect(() => verifyCounterpartyHtlc({ ...goodSwap, status: 2 }, expectation)).toThrow(/active/i);
  });
  it('is case-insensitive for addresses/hashlock', () => {
    expect(() => verifyCounterpartyHtlc(
      { ...goodSwap, participant: ME.toUpperCase(), token: TOKEN.toUpperCase(), hashlock: H.toUpperCase() },
      expectation,
    )).not.toThrow();
  });
});

/**
 * V-2: before revealing the secret via withdraw, verify the HTLC you are
 * withdrawing from actually pays YOU and is bound to the hashlock whose preimage
 * you are about to publish. Prevents revealing the secret against an attacker's
 * decoy HTLC (hashlock-collision) that pays the attacker.
 */
describe('assertClaimableByMe (V-2 — before revealing the secret)', () => {
  it('passes when the swap pays me and the hashlock matches', () => {
    expect(() => assertClaimableByMe(goodSwap, ME, H)).not.toThrow();
  });
  it('refuses to reveal against a swap that pays the attacker', () => {
    expect(() => assertClaimableByMe({ ...goodSwap, participant: ATTACKER }, ME, H)).toThrow(/participant/i);
  });
  it('refuses to reveal against a hashlock-collision decoy', () => {
    expect(() => assertClaimableByMe({ ...goodSwap, hashlock: '0xdead000000000000000000000000000000000000000000000000000000000000' }, ME, H)).toThrow(/hashlock/i);
  });
  it('refuses on a non-active swap', () => {
    expect(() => assertClaimableByMe({ ...goodSwap, status: 2 }, ME, H)).toThrow(/active/i);
  });
});
