import { describe, it, expect } from 'vitest';
import {
  assertSuiClaimableByMe,
  normalizeSuiHashlock,
  type SuiOnchainSwap,
} from './suiSwapVerify';

/**
 * V-2 (SUI side): before a party reveals the secret by withdrawing a SUI HTLC, the on-chain
 * Swap object must actually pay them, carry the expected hashlock, be active, and hold a real
 * balance — otherwise a same-hashlock decoy with a dust balance could induce a premature reveal.
 * Mirrors assertClaimableByMe on the EVM legs.
 */
const ME = '0x' + 'a'.repeat(64);
const HASHLOCK = '0x' + '1'.repeat(64);

function activeSwap(over: Partial<SuiOnchainSwap> = {}): SuiOnchainSwap {
  return { status: 1, participant: ME, hashlock: HASHLOCK, amount: 1000n, ...over };
}

describe('assertSuiClaimableByMe (V-2)', () => {
  it('passes for an active swap that pays me with the expected hashlock', () => {
    expect(() => assertSuiClaimableByMe(activeSwap(), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).not.toThrow();
  });

  it('rejects a non-active swap', () => {
    expect(() => assertSuiClaimableByMe(activeSwap({ status: 2 }), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).toThrow(/not active/i);
  });

  it('rejects a swap that pays someone else', () => {
    expect(() => assertSuiClaimableByMe(activeSwap({ participant: '0x' + 'b'.repeat(64) }), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).toThrow(/does not pay/i);
  });

  it('rejects a hashlock mismatch (decoy)', () => {
    expect(() => assertSuiClaimableByMe(activeSwap({ hashlock: '0x' + '2'.repeat(64) }), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).toThrow(/hashlock/i);
  });

  it('rejects a zero-balance decoy', () => {
    expect(() => assertSuiClaimableByMe(activeSwap({ amount: 0n }), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).toThrow(/balance/i);
  });

  it('rejects when amount is below the expected minimum', () => {
    expect(() => assertSuiClaimableByMe(activeSwap({ amount: 5n }), { mySuiAddress: ME, expectedHashlock: HASHLOCK, minAmount: 100n })).toThrow(/below expected/i);
  });

  it('is case- and padding-insensitive on the participant address', () => {
    const shortMe = '0x' + 'A'.repeat(64); // upper-case
    expect(() => assertSuiClaimableByMe(activeSwap({ participant: shortMe }), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).not.toThrow();
  });

  it('does NOT block when the object hashlock is unparseable (lenient, fail-open only on parse)', () => {
    // null hashlock (couldn't parse) must not break a legitimate withdraw — the Move contract
    // still enforces secret==hashlock on-chain.
    expect(() => assertSuiClaimableByMe(activeSwap({ hashlock: null }), { mySuiAddress: ME, expectedHashlock: HASHLOCK })).not.toThrow();
  });
});

describe('normalizeSuiHashlock', () => {
  it('converts a byte array to lowercase 0x-hex', () => {
    expect(normalizeSuiHashlock([0x12, 0x34, 0xab])).toBe('0x1234ab');
  });
  it('passes through a hex string (lowercased, 0x-prefixed)', () => {
    expect(normalizeSuiHashlock('AB12')).toBe('0xab12');
    expect(normalizeSuiHashlock('0xAb12')).toBe('0xab12');
  });
  it('returns null for unparseable input', () => {
    expect(normalizeSuiHashlock(undefined)).toBeNull();
    expect(normalizeSuiHashlock(123)).toBeNull();
  });
});
