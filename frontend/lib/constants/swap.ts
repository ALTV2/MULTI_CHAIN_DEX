/** HTLC swap status codes (matches on-chain enum) */
export const HTLC_STATUS = {
  EMPTY: 0,
  ACTIVE: 1,
  WITHDRAWN: 2,
  REFUNDED: 3,
} as const;

export const HTLC_STATUS_MAP: Record<number, string> = {
  [HTLC_STATUS.EMPTY]: 'Empty',
  [HTLC_STATUS.ACTIVE]: 'Active',
  [HTLC_STATUS.WITHDRAWN]: 'Withdrawn',
  [HTLC_STATUS.REFUNDED]: 'Refunded',
};

/** CrossChainOrderBook order status codes (matches on-chain enum) */
export const ORDER_STATUS = {
  ACTIVE: 0,
  MATCHED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
  EXPIRED: 4,
} as const;

export const ORDER_STATUS_MAP: Record<number, string> = {
  [ORDER_STATUS.ACTIVE]: 'Active',
  [ORDER_STATUS.MATCHED]: 'Matched',
  [ORDER_STATUS.COMPLETED]: 'Completed',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
  [ORDER_STATUS.EXPIRED]: 'Expired',
};

/** Polling intervals (ms) */
export const SWAP_SCAN_COOLDOWN_MS = 30_000;
export const AUTO_REFRESH_INTERVAL_MS = 30_000;
export const ORDER_BOOK_REFETCH_MS = 60_000;
export const ORDER_BOOK_STALE_MS = 30_000;
export const SECRET_POLL_INTERVAL_MS = 30_000;

/** Event log scan parameters */
export const EVENT_LOG_CHUNK_SIZE = 10n;
export const EVENT_LOG_MAX_BLOCKS = 5000n;
export const EVENT_LOG_CONCURRENCY = 10;

/** Order book batch size for on-chain reads */
export const ORDER_BOOK_BATCH_SIZE = 10;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
