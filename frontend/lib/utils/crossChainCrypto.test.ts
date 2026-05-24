import { describe, it, expect } from 'vitest';
import { keccak256 } from 'viem';
import {
  generateSecret,
  generateHashlock,
  generateSwapId,
  hexToBytes,
  bytesToHex,
  isValidSecret,
  isValidHashlock,
  calculateTimelock,
} from './crossChainCrypto';

// A canonical 32-byte secret used across deterministic assertions.
const SECRET = `0x${'ab'.repeat(32)}` as `0x${string}`;
const HASHLOCK = generateHashlock(SECRET);
const ALICE = '0x1111111111111111111111111111111111111111';
const BOB = '0x2222222222222222222222222222222222222222';

describe('generateSecret', () => {
  it('returns a 0x-prefixed 32-byte hex string', () => {
    const s = generateSecret();
    expect(s).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('produces a value accepted by isValidSecret', () => {
    expect(isValidSecret(generateSecret())).toBe(true);
  });

  it('is non-deterministic across calls', () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});

describe('generateHashlock', () => {
  it('matches the well-known keccak256 of empty input (primitive anchor)', () => {
    expect(keccak256('0x')).toBe(
      '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    );
  });

  it('equals the plain keccak256 of the raw 32-byte secret (contract invariant)', () => {
    // abi.encode(bytes32) is the identity, so the on-chain Solidity/Move hash of
    // the secret bytes must equal keccak256(secret). This is what makes the
    // hashlock interoperable across EVM and SUI.
    expect(generateHashlock(SECRET)).toBe(keccak256(SECRET));
  });

  it('is deterministic for the same secret', () => {
    expect(generateHashlock(SECRET)).toBe(generateHashlock(SECRET));
  });

  it('differs for different secrets', () => {
    const other = `0x${'cd'.repeat(32)}` as `0x${string}`;
    expect(generateHashlock(SECRET)).not.toBe(generateHashlock(other));
  });

  it('produces a value accepted by isValidHashlock', () => {
    expect(isValidHashlock(generateHashlock(generateSecret()))).toBe(true);
  });
});

describe('generateSwapId', () => {
  const baseId = generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 11155111);

  it('is deterministic for identical inputs', () => {
    expect(generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 11155111)).toBe(baseId);
  });

  it('returns a valid 32-byte hex', () => {
    expect(baseId).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('changes with the initiator', () => {
    expect(generateSwapId(BOB, BOB, HASHLOCK, 1000n, 11155111)).not.toBe(baseId);
  });

  it('changes with the participant', () => {
    expect(generateSwapId(ALICE, ALICE, HASHLOCK, 1000n, 11155111)).not.toBe(baseId);
  });

  it('changes with the timelock', () => {
    expect(generateSwapId(ALICE, BOB, HASHLOCK, 2000n, 11155111)).not.toBe(baseId);
  });

  it('changes with the chain id', () => {
    expect(generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 80002)).not.toBe(baseId);
  });

  it('distinguishes a numeric chain id from a string chain id', () => {
    const suiId = generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 'sui:testnet');
    expect(suiId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(suiId).not.toBe(baseId);
  });

  it('distinguishes two different string chain ids', () => {
    expect(generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 'sui:testnet')).not.toBe(
      generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 'sui:mainnet')
    );
  });

  it('treats number and bigint timelocks as equivalent', () => {
    expect(generateSwapId(ALICE, BOB, HASHLOCK, 1000, 11155111)).toBe(
      generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 11155111)
    );
  });

  it('normalizes addresses to 32 bytes (short and zero-padded forms collide)', () => {
    const short = generateSwapId('0x1234', BOB, HASHLOCK, 1000n, 11155111);
    const padded = generateSwapId(
      `0x${'1234'.padStart(64, '0')}`,
      BOB,
      HASHLOCK,
      1000n,
      11155111
    );
    expect(short).toBe(padded);
  });

  it('treats a 20-byte EVM address as its 32-byte zero-padded form', () => {
    const evm = generateSwapId(ALICE, BOB, HASHLOCK, 1000n, 11155111);
    const padded = generateSwapId(
      `0x${ALICE.slice(2).padStart(64, '0')}`,
      BOB,
      HASHLOCK,
      1000n,
      11155111
    );
    expect(evm).toBe(padded);
  });
});

describe('hexToBytes', () => {
  it('converts a 0x-prefixed hex string', () => {
    expect(Array.from(hexToBytes('0x1234'))).toEqual([0x12, 0x34]);
  });

  it('converts an un-prefixed hex string', () => {
    expect(Array.from(hexToBytes('1234'))).toEqual([0x12, 0x34]);
  });

  it('returns an empty array for "0x"', () => {
    expect(hexToBytes('0x').length).toBe(0);
  });
});

describe('bytesToHex', () => {
  it('converts bytes to a 0x-prefixed hex string', () => {
    expect(bytesToHex(new Uint8Array([0x00, 0xff]))).toBe('0x00ff');
  });

  it('round-trips with hexToBytes', () => {
    expect(bytesToHex(hexToBytes('0xdeadbeef'))).toBe('0xdeadbeef');
  });
});

describe('isValidSecret', () => {
  it('accepts a 0x-prefixed 32-byte hex', () => {
    expect(isValidSecret(SECRET)).toBe(true);
  });

  it('accepts an un-prefixed 32-byte hex', () => {
    expect(isValidSecret('ab'.repeat(32))).toBe(true);
  });

  it('rejects a value of the wrong length', () => {
    expect(isValidSecret(`0x${'ab'.repeat(31)}`)).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidSecret(`0x${'zz'.repeat(32)}`)).toBe(false);
  });
});

describe('isValidHashlock', () => {
  it('accepts a real keccak256 hashlock', () => {
    expect(isValidHashlock(HASHLOCK)).toBe(true);
  });

  it('rejects a malformed hashlock', () => {
    expect(isValidHashlock('0xabc')).toBe(false);
  });
});

describe('calculateTimelock', () => {
  it('gives the first swap a longer timelock than the second', () => {
    expect(calculateTimelock(true)).toBeGreaterThan(calculateTimelock(false));
  });

  it('returns a bigint', () => {
    expect(typeof calculateTimelock(true)).toBe('bigint');
  });

  it('respects a custom base, with first = 2x second offset', () => {
    const first = calculateTimelock(true, 10);
    const second = calculateTimelock(false, 10);
    // first ≈ now + 20h, second ≈ now + 10h → difference is base hours in seconds.
    expect(Math.abs(Number(first - second) - 10 * 3600)).toBeLessThanOrEqual(2);
  });

  it('anchors the first-swap timelock near now + 2*base hours', () => {
    const now = Math.floor(Date.now() / 1000);
    const t = Number(calculateTimelock(true, 1));
    expect(Math.abs(t - (now + 2 * 3600))).toBeLessThanOrEqual(2);
  });
});
