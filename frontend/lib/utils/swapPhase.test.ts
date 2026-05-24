import { describe, it, expect } from 'vitest';
import {
  determineSwapPhase,
  getPhaseDescription,
  getPhaseStepIndex,
  getRequiredChain,
} from './swapPhase';
import type { StoredSwapMeta, SwapPhase } from '@/types/swap';

const PAST = BigInt(Math.floor(Date.now() / 1000) - 3600);
const FUTURE = BigInt(Math.floor(Date.now() / 1000) + 3600);

function meta(overrides: Partial<StoredSwapMeta> = {}): StoredSwapMeta {
  return {
    orderId: '1',
    role: 'creator',
    sourceChainId: 11155111,
    targetChainId: 80002,
    hashlock: '0x',
    sellToken: '0xsell',
    sellAmount: '1',
    buyToken: '0xbuy',
    buyAmount: '1',
    creator: '0xcreator',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('determineSwapPhase — EVM↔EVM', () => {
  it('order_created when nothing has happened', () => {
    expect(determineSwapPhase({ meta: meta() })).toBe('order_created');
  });
  it('order_matched when a matcher is present', () => {
    expect(determineSwapPhase({ meta: meta({ matcher: '0xm' }) })).toBe('order_matched');
  });
  it('completed when the CCOB order is Completed', () => {
    expect(determineSwapPhase({ meta: meta(), orderStatus: 'Completed' })).toBe('completed');
  });
  it('creator_htlc_created when only the creator locked', () => {
    expect(determineSwapPhase({ meta: meta({ matcher: '0xm' }), creatorHtlcStatus: 'Active' })).toBe('creator_htlc_created');
  });
  it('matcher_htlc_created when both HTLCs are active', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Active',
      matcherHtlcStatus: 'Active',
      creatorHtlcTimelock: FUTURE,
      matcherHtlcTimelock: FUTURE,
    })).toBe('matcher_htlc_created');
  });
  it('secret_revealed when matcher withdrew but creator HTLC still active', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Active',
      matcherHtlcStatus: 'Withdrawn',
      creatorHtlcTimelock: FUTURE,
    })).toBe('secret_revealed');
  });
  it('completed when both HTLCs are withdrawn', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Withdrawn',
      matcherHtlcStatus: 'Withdrawn',
    })).toBe('completed');
  });
  it('refunded when the user HTLC is refunded', () => {
    expect(determineSwapPhase({ meta: meta({ role: 'creator' }), creatorHtlcStatus: 'Refunded' })).toBe('refunded');
  });
  it('refundable when creator HTLC active but timelock expired', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Active',
      creatorHtlcTimelock: PAST,
    })).toBe('refundable');
  });
});

describe('determineSwapPhase — SUI inference', () => {
  it('SUI→EVM: infers matcher HTLC Active from stored swapId (Pattern 2 → order_matched)', () => {
    const phase = determineSwapPhase({
      meta: meta({ sourceChainId: 'sui:testnet', targetChainId: 11155111, matcher: '0xm', matcherHtlcSwapId: '0xabc', matcherHtlcTimelock: FUTURE } as Partial<StoredSwapMeta>),
      matcherHtlcTimelock: FUTURE,
    });
    expect(phase).toBe('order_matched');
  });
  it('EVM→SUI: infers matcher HTLC Active from stored object id', () => {
    const phase = determineSwapPhase({
      meta: meta({ targetChainId: 'sui:testnet', matcher: '0xm', creatorHtlcObjectId: undefined, matcherHtlcObjectId: '0xobj' }),
      creatorHtlcStatus: 'Active',
      creatorHtlcTimelock: FUTURE,
      matcherHtlcTimelock: FUTURE,
    });
    expect(phase).toBe('matcher_htlc_created');
  });
});

describe('determineSwapPhase — refund & edge branches', () => {
  it('refunded when both HTLCs are refunded', () => {
    expect(determineSwapPhase({
      meta: meta({ role: 'matcher', matcher: '0xm' }),
      creatorHtlcStatus: 'Refunded',
      matcherHtlcStatus: 'Refunded',
    })).toBe('refunded');
  });
  it('refundable when secret revealed but creator timelock expired', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Active',
      matcherHtlcStatus: 'Withdrawn',
      creatorHtlcTimelock: PAST,
    })).toBe('refundable');
  });
  it('SUI→EVM pattern 2: creator HTLC withdrawn, matcher active → secret_revealed', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Withdrawn',
      matcherHtlcStatus: 'Active',
      matcherHtlcTimelock: FUTURE,
    })).toBe('secret_revealed');
  });
  it('refundable when creator withdrawn + matcher active but matcher timelock expired', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Withdrawn',
      matcherHtlcStatus: 'Active',
      matcherHtlcTimelock: PAST,
    })).toBe('refundable');
  });
  it('refundable when both active but matcher timelock expired', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      creatorHtlcStatus: 'Active',
      matcherHtlcStatus: 'Active',
      creatorHtlcTimelock: FUTURE,
      matcherHtlcTimelock: PAST,
    })).toBe('refundable');
  });
  it('only matcher HTLC active (EVM) → creator_htlc_created', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      matcherHtlcStatus: 'Active',
      matcherHtlcTimelock: FUTURE,
    })).toBe('creator_htlc_created');
  });
  it('only matcher HTLC active but matcher timelock expired → refundable', () => {
    expect(determineSwapPhase({
      meta: meta({ matcher: '0xm' }),
      matcherHtlcStatus: 'Active',
      matcherHtlcTimelock: PAST,
    })).toBe('refundable');
  });
  it('matcher active while creator refunded → creator_htlc_created (re-lock expected)', () => {
    expect(determineSwapPhase({
      meta: meta({ role: 'matcher', matcher: '0xm' }),
      creatorHtlcStatus: 'Refunded',
      matcherHtlcStatus: 'Active',
      matcherHtlcTimelock: FUTURE,
    })).toBe('creator_htlc_created');
  });
});

describe('getRequiredChain — SUI source branches', () => {
  const sui = meta({ sourceChainId: 'sui:testnet', targetChainId: 11155111 });
  it('matcher_htlc_created → SUI matcher withdraws on source chain', () => {
    expect(getRequiredChain('matcher_htlc_created', 'matcher', sui)).toBe('sui:testnet');
  });
  it('secret_revealed → SUI creator claims on target chain', () => {
    expect(getRequiredChain('secret_revealed', 'creator', sui)).toBe(11155111);
  });
});

describe('getPhaseDescription — SUI matcher overrides', () => {
  it('order_matched / matcher_htlc_created / secret_revealed each return SUI matcher copy', () => {
    expect(getPhaseDescription('order_matched', 'matcher', 'sui:testnet')).toMatch(/EVM/);
    expect(getPhaseDescription('matcher_htlc_created', 'matcher', 'sui:testnet')).toMatch(/SUI HTLC/);
    expect(getPhaseDescription('secret_revealed', 'matcher', 'sui:testnet')).toMatch(/secret/i);
  });
});

describe('getPhaseStepIndex', () => {
  const expected: Record<SwapPhase, number> = {
    order_created: 1,
    order_matched: 2,
    creator_htlc_created: 3,
    matcher_htlc_created: 4,
    secret_revealed: 5,
    completed: 6,
    refundable: -1,
    refunded: -1,
  };
  it('maps each phase to its step index', () => {
    (Object.keys(expected) as SwapPhase[]).forEach((p) => {
      expect(getPhaseStepIndex(p)).toBe(expected[p]);
    });
  });
});

describe('getRequiredChain', () => {
  const m = meta({ sourceChainId: 11155111, targetChainId: 80002 });
  it('order_matched → creator acts on source chain', () => {
    expect(getRequiredChain('order_matched', 'creator', m)).toBe(11155111);
    expect(getRequiredChain('order_matched', 'matcher', m)).toBeNull();
  });
  it('creator_htlc_created → matcher acts on target chain', () => {
    expect(getRequiredChain('creator_htlc_created', 'matcher', m)).toBe(80002);
  });
  it('matcher_htlc_created → creator withdraws on target chain', () => {
    expect(getRequiredChain('matcher_htlc_created', 'creator', m)).toBe(80002);
  });
  it('refundable → each party refunds where they locked', () => {
    expect(getRequiredChain('refundable', 'creator', m)).toBe(11155111);
    expect(getRequiredChain('refundable', 'matcher', m)).toBe(80002);
  });
  it('secret_revealed → matcher withdraws on source chain (EVM)', () => {
    expect(getRequiredChain('secret_revealed', 'matcher', m)).toBe(11155111);
  });
  it('completed → no action required', () => {
    expect(getRequiredChain('completed', 'creator', m)).toBeNull();
  });
});

describe('getPhaseDescription', () => {
  it('returns role-specific copy for a known phase', () => {
    expect(getPhaseDescription('completed', 'creator')).toMatch(/completed/i);
  });
  it('uses SUI-source override copy', () => {
    const text = getPhaseDescription('order_matched', 'creator', 'sui:testnet');
    expect(text).toMatch(/SUI/);
  });
  it('falls back to "Unknown phase"', () => {
    expect(getPhaseDescription('completed', 'nobody')).toBe('Unknown phase');
  });
});
