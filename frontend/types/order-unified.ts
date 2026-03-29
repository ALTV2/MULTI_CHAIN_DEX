/**
 * Unified order type used across the frontend.
 * Formerly defined in useAllUnifiedOrdersFixed.ts — extracted for clean imports.
 */

export type CrossChainOrderStatus = 'Active' | 'Matched' | 'Completed' | 'Cancelled' | 'Expired';

export interface SuiSameChainMeta {
  orderObjectId: string;
  coinAType: string;
  coinBType: string;
  pairId: string;
}

export interface UnifiedOrder {
  id: bigint;
  creator: string;
  matchedBy: string;
  sellToken: string;
  buyToken: string;
  sellAmount: bigint;
  buyAmount: bigint;
  targetChainId: number | string;
  targetAddress: string;
  minTimelock: bigint;
  expiresAt: bigint;
  status: CrossChainOrderStatus | string;
  price: number;
  inversePrice: number;
  sellSymbol: string;
  buySymbol: string;
  formattedSellAmount: string;
  formattedBuyAmount: string;
  sourceChainIdNum: number | string;
  targetChainIdNum: number | string;
  orderType?: string;
  suiSameChainMeta?: SuiSameChainMeta;
}
