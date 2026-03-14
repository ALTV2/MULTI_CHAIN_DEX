import { formatEther, formatUnits } from 'viem';

/**
 * Format token amount with correct decimals based on chain
 * - EVM chains (Sepolia, Polygon Amoy): 18 decimals
 * - SUI chain: 9 decimals
 *
 * IMPORTANT: SUI orders store ALL amounts with 9 decimals (both sell and buy),
 * even for cross-chain orders targeting EVM chains. This is due to Move u64 limitations.
 */
export function formatAmount(
  amount: bigint | string,
  chainId: number | string,
  decimals?: number,
  sourceChainId?: number | string  // NEW: For cross-chain orders from SUI
): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;

  // CRITICAL: Check SUI source FIRST, before using explicit decimals!
  // SUI Move contracts store all amounts with 9 decimals due to u64 limitations,
  // even for cross-chain orders targeting EVM chains with 18 decimal tokens.
  if (sourceChainId && typeof sourceChainId === 'string' && sourceChainId.includes('sui')) {
    return formatUnits(amountBigInt, 9);
  }

  // If explicit decimals provided, use them (only for non-SUI orders)
  if (decimals !== undefined) {
    return formatUnits(amountBigInt, decimals);
  }

  // Auto-detect decimals based on current chain
  if (typeof chainId === 'string' && chainId.includes('sui')) {
    // SUI uses 9 decimals
    return formatUnits(amountBigInt, 9);
  }

  // EVM chains use 18 decimals
  return formatEther(amountBigInt);
}
