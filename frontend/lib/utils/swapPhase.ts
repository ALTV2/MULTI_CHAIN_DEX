import type { SwapPhase, StoredSwapMeta } from '@/types/swap';

/**
 * Determine the current phase of a swap based on on-chain data.
 *
 * State machine:
 * order_created → order_matched → creator_htlc_created → matcher_htlc_created
 *   → secret_revealed → completed
 *
 * At any Active HTLC stage, if timelock expired → refundable
 * If already refunded → refunded
 */
export function determineSwapPhase(params: {
  meta: StoredSwapMeta;
  orderStatus?: string;       // CCOB order status
  creatorHtlcStatus?: string; // 'Empty' | 'Active' | 'Withdrawn' | 'Refunded'
  matcherHtlcStatus?: string;
  creatorHtlcTimelock?: bigint;
  matcherHtlcTimelock?: bigint;
}): SwapPhase {
  const {
    meta,
    orderStatus,
    creatorHtlcTimelock,
    matcherHtlcTimelock,
  } = params;

  // For SUI chains, on-chain HTLC status is not fetched by useActiveSwaps (EVM-only scanner).
  // Infer HTLC existence from stored metadata object IDs / swap IDs instead.
  const isSuiSource = typeof meta.sourceChainId === 'string';
  const isSuiTarget = typeof meta.targetChainId === 'string';

  let creatorHtlcStatus = params.creatorHtlcStatus;
  let matcherHtlcStatus = params.matcherHtlcStatus;

  // SUI source (SUI→EVM): infer HTLC statuses from stored metadata and withdrawal flags
  if (isSuiSource) {
    if (!creatorHtlcStatus) {
      if (meta.creatorHtlcWithdrawn) creatorHtlcStatus = 'Withdrawn';
      else if (meta.creatorHtlcObjectId || meta.creatorHtlcSwapId) creatorHtlcStatus = 'Active';
    }
    if (!matcherHtlcStatus && meta.matcherHtlcSwapId) {
      matcherHtlcStatus = meta.matcherHtlcWithdrawn ? 'Withdrawn' : 'Active';
    }
  }

  // SUI target (EVM→SUI): infer matcher HTLC status from stored metadata and withdrawal flag
  if (isSuiTarget) {
    if (!matcherHtlcStatus) {
      if (meta.matcherHtlcWithdrawn) matcherHtlcStatus = 'Withdrawn';
      else if (meta.matcherHtlcObjectId || meta.matcherHtlcSwapId) matcherHtlcStatus = 'Active';
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  // If CCOB order is completed
  if (orderStatus === 'Completed') {
    return 'completed';
  }

  // Check if current user's HTLC is refunded (role-based)
  // Creator locks on source chain, matcher locks on target chain
  const userIsCreator = meta.role === 'creator';
  const userHtlcStatus = userIsCreator ? creatorHtlcStatus : matcherHtlcStatus;
  const counterpartyHtlcStatus = userIsCreator ? matcherHtlcStatus : creatorHtlcStatus;

  // If user's own HTLC is refunded, they got their tokens back
  if (userHtlcStatus === 'Refunded') {
    return 'refunded';
  }

  // If both HTLCs are refunded (swap failed completely for both sides)
  if (creatorHtlcStatus === 'Refunded' && matcherHtlcStatus === 'Refunded') {
    return 'refunded';
  }

  // If we have an expired timelock but HTLC is not Active, the swap has failed
  // This catches cases where:
  // - Creator/matcher created HTLC but already refunded/withdrawn
  // - Timelock expired while waiting for the other party
  if (creatorHtlcTimelock && now >= creatorHtlcTimelock && creatorHtlcStatus !== 'Active') {
    return 'refundable';
  }
  if (matcherHtlcTimelock && now >= matcherHtlcTimelock && matcherHtlcStatus !== 'Active') {
    return 'refundable';
  }

  // If matcher's HTLC has been withdrawn (creator revealed the secret)
  // AND creator's HTLC has been withdrawn (matcher used the secret)
  if (creatorHtlcStatus === 'Withdrawn' && matcherHtlcStatus === 'Withdrawn') {
    return 'completed';
  }

  // If matcher's HTLC has been withdrawn (creator revealed secret)
  // but creator's HTLC is still active (matcher hasn't withdrawn yet)
  if (matcherHtlcStatus === 'Withdrawn' && creatorHtlcStatus === 'Active') {
    // Check if creator's HTLC timelock expired → matcher can't withdraw, creator can refund
    if (creatorHtlcTimelock && now >= creatorHtlcTimelock) {
      return 'refundable';
    }
    return 'secret_revealed';
  }

  // Pattern 2 (SUI→EVM): creator's SUI HTLC was withdrawn by matcher (secret revealed on SUI).
  // Matcher's EVM HTLC is still active — creator can now claim it using the revealed secret.
  if (creatorHtlcStatus === 'Withdrawn' && matcherHtlcStatus === 'Active') {
    if (matcherHtlcTimelock && now >= matcherHtlcTimelock) {
      return 'refundable';
    }
    return 'secret_revealed';
  }

  // Both HTLCs exist and are active
  if (creatorHtlcStatus === 'Active' && matcherHtlcStatus === 'Active') {
    // Check if matcher's HTLC timelock is expired (creator can't withdraw)
    if (matcherHtlcTimelock && now >= matcherHtlcTimelock) {
      return 'refundable';
    }
    return 'matcher_htlc_created';
  }

  // Only creator's HTLC exists (or matcher refunded already)
  if (creatorHtlcStatus === 'Active' && (!matcherHtlcStatus || matcherHtlcStatus === 'Empty' || matcherHtlcStatus === 'Refunded')) {
    // Check if timelock expired
    if (creatorHtlcTimelock && now >= creatorHtlcTimelock) {
      return 'refundable';
    }
    return 'creator_htlc_created';
  }

  // Only matcher's HTLC exists (or creator refunded already)
  if (matcherHtlcStatus === 'Active' && (!creatorHtlcStatus || creatorHtlcStatus === 'Empty' || creatorHtlcStatus === 'Refunded')) {
    // Check if matcher's timelock expired — then matcher can refund
    if (matcherHtlcTimelock && now >= matcherHtlcTimelock) {
      return 'refundable';
    }
    // SUI→EVM Pattern 2: matcher locked EVM HTLC first, creator still needs to create SUI counter-HTLC
    if (isSuiSource) return 'order_matched';
    // EVM→EVM standard: creator already locked, matcher locked but creator refunded → creator needs to re-lock
    return 'creator_htlc_created';
  }

  // If counterparty refunded but user's HTLC is still active
  if (userHtlcStatus === 'Active' && counterpartyHtlcStatus === 'Refunded') {
    const userTimelock = userIsCreator ? creatorHtlcTimelock : matcherHtlcTimelock;
    if (userTimelock && now >= userTimelock) {
      return 'refundable';
    }
    // Swap failed, user should refund
    return 'refundable';
  }

  // Order is matched but no HTLCs created yet
  if (orderStatus === 'Matched' || meta.matcher) {
    return 'order_matched';
  }

  // Order is just created, not matched
  return 'order_created';
}

export function getPhaseDescription(phase: SwapPhase, role: string, sourceChainId?: number | string): string {
  const isSuiSource = typeof sourceChainId === 'string';

  // SUI→EVM flow has reversed lock order: matcher locks EVM first (during matching),
  // then creator locks SUI counter-HTLC. Override descriptions for clarity.
  if (isSuiSource) {
    if (phase === 'order_matched' && role === 'creator') {
      return 'Order matched! Counterparty has locked EVM tokens. Now lock your SUI tokens to continue.';
    }
    if (phase === 'order_matched' && role === 'matcher') {
      return 'You locked EVM tokens in HTLC. Waiting for the creator to lock their SUI tokens as counter-HTLC.';
    }
    if (phase === 'matcher_htlc_created' && role === 'creator') {
      return 'Both sides locked! Your SUI tokens are locked, and the counterparty locked EVM tokens. Waiting for them to withdraw from your SUI HTLC — this will reveal the secret.';
    }
    if (phase === 'matcher_htlc_created' && role === 'matcher') {
      return 'Both sides locked! Withdraw from the creator\'s SUI HTLC to reveal your secret and complete the swap.';
    }
    if (phase === 'secret_revealed' && role === 'creator') {
      return 'Secret revealed! The counterparty withdrew your SUI tokens. Use the secret to claim your EVM tokens.';
    }
    if (phase === 'secret_revealed' && role === 'matcher') {
      return 'You revealed the secret by withdrawing SUI tokens. Waiting for the creator to claim EVM tokens to complete the swap.';
    }
  }

  const descriptions: Record<SwapPhase, Record<string, string>> = {
    order_created: {
      creator: 'Waiting for someone to match your order',
      matcher: 'Order available for matching',
    },
    order_matched: {
      creator: 'Order matched! Lock your tokens to start the trade',
      matcher: 'Order matched! Wait for the initiator to lock tokens first',
    },
    creator_htlc_created: {
      creator: 'Your tokens are locked. Waiting for counterparty to lock their tokens',
      matcher: 'Initiator locked tokens. Now lock your tokens on the target chain',
    },
    matcher_htlc_created: {
      creator: 'Both sides locked! Withdraw from the counterparty\'s HTLC to claim your tokens.',
      matcher: 'Both sides locked! Wait for the initiator to claim tokens',
    },
    secret_revealed: {
      creator: 'Claim started! Waiting for counterparty to complete',
      matcher: 'Initiator claimed! Now claim your tokens to finish the trade',
    },
    completed: {
      creator: 'Trade completed successfully!',
      matcher: 'Trade completed successfully!',
    },
    refundable: {
      creator: 'The timelock has expired. The counterparty did not complete their part. Click below to refund your locked tokens.',
      matcher: 'The timelock has expired. The initiator did not complete their part. Click below to refund your locked tokens.',
    },
    refunded: {
      creator: 'Your tokens have been successfully refunded. The trade was not completed.',
      matcher: 'Your tokens have been successfully refunded. The trade was not completed.',
    },
  };

  return descriptions[phase]?.[role] || 'Unknown phase';
}

/**
 * Returns the step index for the stepper component.
 * Steps 0..N-1 below this index are "completed" (green).
 * The step AT this index is "current" (blue).
 *
 * Phase names describe what HAS happened, so the completed step count
 * equals the phase's position + 1. E.g. creator_htlc_created means
 * steps 0 (Order), 1 (Matched), 2 (Creator Locked) are done → index 3.
 */
export function getPhaseStepIndex(phase: SwapPhase): number {
  switch (phase) {
    case 'order_created': return 1;       // Step 0 done, step 1 is current
    case 'order_matched': return 2;       // Steps 0-1 done, step 2 is current
    case 'creator_htlc_created': return 3; // Steps 0-2 done, step 3 is current
    case 'matcher_htlc_created': return 4; // Steps 0-3 done, step 4 is current
    case 'secret_revealed': return 5;      // Steps 0-4 done, step 5 is current
    case 'completed': return 6;            // All 6 steps done
    case 'refundable': return -1;
    case 'refunded': return -1;
  }
}

export function getRequiredChain(phase: SwapPhase, role: string, meta: StoredSwapMeta): number | string | null {
  switch (phase) {
    case 'order_matched':
      // Creator locks on source chain
      return role === 'creator' ? meta.sourceChainId : null;
    case 'creator_htlc_created':
      // Matcher locks on target chain
      return role === 'matcher' ? meta.targetChainId : null;
    case 'matcher_htlc_created': {
      // Creator withdraws from matcher's HTLC (on target chain)
      if (role === 'creator') return meta.targetChainId;
      // SUI→EVM: matcher withdraws from creator's SUI HTLC (on source chain)
      const isSuiSrc = typeof meta.sourceChainId === 'string';
      if (isSuiSrc && role === 'matcher') return meta.sourceChainId;
      return null;
    }
    case 'secret_revealed': {
      // SUI→EVM Pattern 2: creator needs to claim matcher's EVM HTLC (on target EVM chain)
      const isSuiSrc = typeof meta.sourceChainId === 'string';
      if (isSuiSrc && role === 'creator') return meta.targetChainId;
      // Standard EVM: matcher withdraws from creator's HTLC (on source chain)
      return role === 'matcher' ? meta.sourceChainId : null;
    }
    case 'refundable':
      // Refund from the chain where you locked tokens
      return role === 'creator' ? meta.sourceChainId : meta.targetChainId;
    default:
      return null;
  }
}
