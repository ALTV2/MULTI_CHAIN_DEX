/**
 * Cross-chain amount scaling (E-6 fix).
 *
 * Cross-chain orders store both amounts normalized to CROSS_CHAIN_DECIMALS (9),
 * which is u64-safe on SUI. When a leg is settled on an EVM chain whose token
 * uses a different number of decimals, the amount must be re-scaled.
 *
 * The previous implementation used `amount * BigInt(10 ** (evmDecimals - 9))`,
 * which evaluates `BigInt(10 ** negative)` (a non-integer float) and throws a
 * RangeError for any token with fewer than 9 decimals (USDC=6, USDT=6, WBTC=8).
 * This helper does safe integer scaling in BOTH directions.
 */
export const CROSS_CHAIN_DECIMALS = 9;

export function scaleCrossChainAmount(
  amount: bigint,
  targetDecimals: number,
  crossChainDecimals: number = CROSS_CHAIN_DECIMALS
): bigint {
  if (!Number.isInteger(targetDecimals) || targetDecimals < 0) {
    throw new Error(`invalid targetDecimals: ${targetDecimals}`);
  }

  if (targetDecimals >= crossChainDecimals) {
    return amount * 10n ** BigInt(targetDecimals - crossChainDecimals);
  }

  // target has fewer decimals → divide, and refuse to silently drop value
  const divisor = 10n ** BigInt(crossChainDecimals - targetDecimals);
  if (amount % divisor !== 0n) {
    throw new Error(
      `amount ${amount} (9-dec) is not representable at ${targetDecimals} decimals without precision loss`
    );
  }
  return amount / divisor;
}
