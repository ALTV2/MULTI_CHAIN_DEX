export type SwapRole = 'creator' | 'matcher';

export type SwapPhase =
  | 'order_created'       // Order exists on CCOB, waiting for match
  | 'order_matched'       // Order matched, creator needs to lock tokens in HTLC on source chain
  | 'creator_htlc_created' // Creator locked tokens, matcher needs to lock on target chain
  | 'matcher_htlc_created' // Both HTLCs exist, creator withdraws from matcher's HTLC (reveals secret)
  | 'secret_revealed'     // Creator withdrew, matcher reads secret and withdraws from creator's HTLC
  | 'completed'           // Both withdrawals done
  | 'refundable'          // Timelock expired, can refund
  | 'refunded';           // Already refunded

// Stored in localStorage per wallet
export interface StoredSwapMeta {
  orderId: string;           // CCOB order ID (bigint as string)
  role: SwapRole;
  sourceChainId: number | string;     // Chain where the CCOB order was created (number for EVM, string for SUI)
  targetChainId: number | string;     // Target chain for the swap (number for EVM, string for SUI)
  secret?: string;           // Only creator stores secret (hex)
  hashlock: string;          // Hashlock (hex)

  // Token info
  sellToken: string;
  sellAmount: string;        // bigint as string
  buyToken: string;
  buyAmount: string;         // bigint as string

  // Counterparty
  creator: string;           // Order creator address
  matcher?: string;          // Matcher address (set after match)

  // Cross-chain address fields (for SUI u2194 EVM swaps)
  creatorEvmAddress?: string;  // Creator's EVM address (set by matcher when matching SUI orders)
  targetAddress?: string;      // Matcher's cross-chain address for receiving funds

  // HTLC swap IDs (set as HTLCs are created)
  creatorHtlcSwapId?: string;  // HTLC on source chain (creator locks sell tokens)
  matcherHtlcSwapId?: string;  // HTLC on target chain (matcher locks buy tokens)

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// Enriched swap with on-chain data for display
export interface ActiveSwap {
  meta: StoredSwapMeta;
  phase: SwapPhase;

  // On-chain CCOB order status
  orderStatus?: string;
  expiresAt?: bigint;  // Order expiration timestamp (only for cross-chain orders)

  // On-chain HTLC statuses
  creatorHtlcStatus?: string;  // 'Empty' | 'Active' | 'Withdrawn' | 'Refunded'
  matcherHtlcStatus?: string;

  // Timelocks
  creatorHtlcTimelock?: bigint;
  matcherHtlcTimelock?: bigint;

  // Revealed secret (from SwapWithdrawn event)
  revealedSecret?: string;
}
