/**
 * Maps backend API responses (SwapDto, OrderDto) to frontend types (ActiveSwap)
 * so existing SwapCard/SwapActionPanel components work without changes.
 */

import type { SwapDto, OrderDto } from './dexApi';
import type { ActiveSwap, SwapPhase, StoredSwapMeta } from '@/types/swap';

/** Convert SwapDto from backend to ActiveSwap for SwapCard. */
export function swapDtoToActiveSwap(dto: SwapDto): ActiveSwap {
  const o = dto.order;

  const sourceChainId = parseChainId(o.sourceChainId);
  const targetChainId = o.targetChainId ? parseChainId(o.targetChainId) : sourceChainId;

  const meta: StoredSwapMeta = {
    orderId: o.onChainOrderId,
    role: dto.role as 'creator' | 'matcher',
    sourceChainId,
    targetChainId,
    hashlock: dto.creatorHtlc?.hashlock || dto.matcherHtlc?.hashlock || '',
    secret: undefined, // Secret stays in browser localStorage only

    sellToken: o.sellToken?.address || '',
    sellAmount: o.sellAmount,
    buyToken: o.buyToken?.address || '',
    buyAmount: o.buyAmount,

    creator: o.creator,
    matcher: o.matcher || undefined,
    targetAddress: o.targetAddress || undefined,

    // HTLC IDs from backend
    creatorHtlcSwapId: dto.creatorHtlc?.onChainSwapId || undefined,
    matcherHtlcSwapId: dto.matcherHtlc?.onChainSwapId || undefined,
    creatorHtlcObjectId: dto.creatorHtlc?.suiObjectId || undefined,
    matcherHtlcObjectId: dto.matcherHtlc?.suiObjectId || undefined,

    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const phase = dto.phase.toLowerCase() as SwapPhase;

  return {
    meta,
    phase,
    orderStatus: o.status,
    expiresAt: o.expiresAt ? BigInt(o.expiresAt) : undefined,

    creatorHtlcStatus: dto.creatorHtlc?.status,
    matcherHtlcStatus: dto.matcherHtlc?.status,
    creatorHtlcTimelock: dto.creatorHtlc?.timelock ? BigInt(dto.creatorHtlc.timelock) : undefined,
    matcherHtlcTimelock: dto.matcherHtlc?.timelock ? BigInt(dto.matcherHtlc.timelock) : undefined,

    revealedSecret: dto.revealedSecret || undefined,
  };
}

/** Convert OrderDto to ActiveSwap (for order book / my orders views). */
export function orderDtoToActiveSwap(dto: OrderDto, role: 'creator' | 'matcher' = 'creator'): ActiveSwap {
  const sourceChainId = parseChainId(dto.sourceChainId);
  const targetChainId = dto.targetChainId ? parseChainId(dto.targetChainId) : sourceChainId;

  const meta: StoredSwapMeta = {
    orderId: dto.onChainOrderId,
    role,
    sourceChainId,
    targetChainId,
    hashlock: '',
    sellToken: dto.sellToken?.address || '',
    sellAmount: dto.sellAmount,
    buyToken: dto.buyToken?.address || '',
    buyAmount: dto.buyAmount,
    creator: dto.creator,
    matcher: dto.matcher || undefined,
    targetAddress: dto.targetAddress || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    meta,
    phase: dto.phase.toLowerCase() as SwapPhase,
    orderStatus: dto.status,
    expiresAt: dto.expiresAt ? BigInt(dto.expiresAt) : undefined,
  };
}

/** Parse chain ID: numeric string → number, "sui:testnet" → string. */
function parseChainId(id: string): number | string {
  if (id.includes(':')) return id; // SUI chain IDs like "sui:testnet"
  const num = parseInt(id, 10);
  return isNaN(num) ? id : num;
}
