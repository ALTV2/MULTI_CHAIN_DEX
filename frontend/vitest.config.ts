import { defineConfig } from 'vitest/config';

/**
 * Unit-test config for pure logic modules (no DOM, no Next.js).
 * Covers the cross-chain crypto utilities that must stay byte-compatible
 * with the Solidity (keccak256) and Move HTLC contracts — see diploma §4.4.1.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
