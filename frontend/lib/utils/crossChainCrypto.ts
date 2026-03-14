/**
 * Cross-Chain Cryptography Utilities
 *
 * Provides consistent hashing and secret generation across EVM and SUI chains
 * Critical for HTLC atomic swaps where secrets must be revealed on one chain
 * and used on another.
 */

import { keccak256, encodeAbiParameters } from 'viem';

/**
 * Generate a random 32-byte secret
 * Works for both EVM and SUI HTLC contracts
 *
 * @returns 32-byte hex string prefixed with 0x
 */
export function generateSecret(): `0x${string}` {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return `0x${Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Generate hashlock from secret using keccak256
 * Compatible with both EVM (Solidity) and SUI (Move) contracts
 *
 * @param secret - 32-byte secret as hex string
 * @returns 32-byte keccak256 hash
 */
export function generateHashlock(secret: `0x${string}`): `0x${string}` {
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }], [secret]));
}

/**
 * Generate deterministic swap ID for cross-chain coordination
 * Both chains use the same swap ID to reference the same logical swap
 *
 * @param initiator - Address of swap initiator
 * @param participant - Address of participant
 * @param hashlock - keccak256 hash of the secret
 * @param timelock - Unix timestamp (seconds) when refund becomes available
 * @param chainId - Chain ID (number for EVM, string for SUI)
 * @returns 32-byte swap ID
 */
export function generateSwapId(
  initiator: string,
  participant: string,
  hashlock: `0x${string}`,
  timelock: bigint | number,
  chainId: number | string
): `0x${string}` {
  // Normalize addresses to 32 bytes for cross-chain compatibility
  const normalizedInitiator = normalizeAddress(initiator, chainId);
  const normalizedParticipant = normalizeAddress(participant, chainId);

  // Convert chain ID to uint256
  const chainIdBigInt =
    typeof chainId === 'string' ? hashChainId(chainId) : BigInt(chainId);

  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' }, // initiator
        { type: 'bytes32' }, // participant
        { type: 'bytes32' }, // hashlock
        { type: 'uint256' }, // timelock
        { type: 'uint256' }, // chainId
      ],
      [
        normalizedInitiator,
        normalizedParticipant,
        hashlock,
        BigInt(timelock),
        chainIdBigInt,
      ]
    )
  );
}

/**
 * Normalize address to 32 bytes for cross-chain compatibility
 * EVM addresses are 20 bytes, SUI addresses are 32 bytes
 *
 * @param address - Address to normalize
 * @param chainId - Chain ID to determine address format
 * @returns 32-byte normalized address
 */
function normalizeAddress(
  address: string,
  chainId: number | string
): `0x${string}` {
  if (typeof chainId === 'string' && chainId.startsWith('sui:')) {
    // SUI addresses are already 32 bytes, just ensure proper format
    return address.startsWith('0x')
      ? (address as `0x${string}`)
      : (`0x${address}` as `0x${string}`);
  } else {
    // EVM addresses are 20 bytes, pad to 32 bytes (left-pad with zeros)
    const cleanAddress = address.replace('0x', '');
    const padded = cleanAddress.padStart(64, '0');
    return `0x${padded}`;
  }
}

/**
 * Hash a string chain ID to uint256 for SUI chains
 * Allows using string identifiers like 'sui:testnet' in swap ID generation
 *
 * @param chainId - String chain identifier
 * @returns BigInt representation
 */
function hashChainId(chainId: string): bigint {
  const hash = keccak256(
    encodeAbiParameters([{ type: 'string' }], [chainId])
  );
  return BigInt(hash);
}

/**
 * Convert hex string to Uint8Array for SUI transactions
 *
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 *
 * @param bytes - Byte array
 * @returns Hex string with 0x prefix
 */
export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  )}`;
}

/**
 * Validate secret format (must be 32 bytes)
 *
 * @param secret - Secret to validate
 * @returns true if valid
 */
export function isValidSecret(secret: string): boolean {
  const cleanSecret = secret.startsWith('0x') ? secret.slice(2) : secret;
  return cleanSecret.length === 64 && /^[0-9a-fA-F]+$/.test(cleanSecret);
}

/**
 * Validate hashlock format (must be 32 bytes keccak256 hash)
 *
 * @param hashlock - Hashlock to validate
 * @returns true if valid
 */
export function isValidHashlock(hashlock: string): boolean {
  const cleanHashlock = hashlock.startsWith('0x')
    ? hashlock.slice(2)
    : hashlock;
  return cleanHashlock.length === 64 && /^[0-9a-fA-F]+$/.test(cleanHashlock);
}

/**
 * Calculate timelock for cross-chain swaps
 * First swap needs longer timelock than second swap to prevent race conditions
 *
 * @param isFirstSwap - Whether this is the first swap in the pair
 * @param baseHours - Base hours for timelock (default 24)
 * @returns Unix timestamp (seconds)
 */
export function calculateTimelock(
  isFirstSwap: boolean,
  baseHours: number = 24
): bigint {
  const now = Math.floor(Date.now() / 1000);
  const hours = isFirstSwap ? baseHours * 2 : baseHours; // First swap gets 2x timelock
  return BigInt(now + hours * 3600);
}
