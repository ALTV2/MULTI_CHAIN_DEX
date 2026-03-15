/**
 * SUI Same-Chain Order Book Pair Registry
 *
 * Manages known OrderBookPair<CoinA, CoinB> object IDs.
 * Starts with hardcoded well-known pairs (TKA↔TKB), and persists
 * dynamically created pairs in localStorage so they survive page reloads.
 */

export const SUI_PKG = '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96';
export const SUI_TKA_TYPE = `${SUI_PKG}::test_token_a::TEST_TOKEN_A`;
export const SUI_TKB_TYPE = `${SUI_PKG}::test_token_b::TEST_TOKEN_B`;
export const SUI_NATIVE_TYPE = '0x2::sui::SUI';

export interface SuiPairConfig {
  pairId: string;     // OrderBookPair<CoinA, CoinB> shared object ID
  coinAType: string;  // full type e.g. "0x...::test_token_a::TEST_TOKEN_A"
  coinBType: string;
}

const STORAGE_KEY = 'sui_order_book_pairs_v1';

/** Hardcoded pairs that were deployed with the contract */
const HARDCODED_PAIRS: SuiPairConfig[] = [
  {
    pairId: '0xdf19c18b4fc74ee7f4d2a407cb6e3ad4758332e2d46c6be3c33796e2aa7dd797',
    coinAType: SUI_TKA_TYPE,
    coinBType: SUI_TKB_TYPE,
  },
  {
    pairId: '0x8079033f69fe176c0e04f0cfc3da841c67dda803a38f7f71c3a8fb318047e876',
    coinAType: SUI_TKB_TYPE,
    coinBType: SUI_TKA_TYPE,
  },
];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Load dynamically created pairs from localStorage */
export function loadStoredPairs(): SuiPairConfig[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SuiPairConfig[]) : [];
  } catch {
    return [];
  }
}

/** Persist a newly created pair to localStorage */
export function registerPair(pair: SuiPairConfig): void {
  if (!isBrowser()) return;
  const existing = loadStoredPairs();
  // Deduplicate by pairId
  if (existing.find((p) => p.pairId === pair.pairId)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, pair]));
  // Also deduplicate by coin pair — if old entry for same tokens exists, remove it
}

/** Return all known pairs: hardcoded + stored */
export function getKnownPairs(): SuiPairConfig[] {
  const hardcodedIds = new Set(HARDCODED_PAIRS.map((p) => p.pairId));
  const stored = loadStoredPairs().filter((p) => !hardcodedIds.has(p.pairId));
  return [...HARDCODED_PAIRS, ...stored];
}

/** Find a pair config for given token types (case-insensitive) */
export function findPairConfig(coinAType: string, coinBType: string): SuiPairConfig | null {
  const a = coinAType.toLowerCase();
  const b = coinBType.toLowerCase();
  return (
    getKnownPairs().find(
      (p) => p.coinAType.toLowerCase() === a && p.coinBType.toLowerCase() === b
    ) ?? null
  );
}
