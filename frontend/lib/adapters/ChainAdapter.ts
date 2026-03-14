/**
 * Chain Adapter Interface
 *
 * Provides a unified interface for interacting with different blockchain types (EVM, SUI, etc.)
 * Enables the frontend to be chain-agnostic by abstracting blockchain-specific implementations.
 */

export type ChainType = 'evm' | 'sui';

// HTLC Parameters
export interface CreateHTLCParams {
  swapId: `0x${string}` | Uint8Array;
  participant: string;
  hashlock: `0x${string}` | Uint8Array;
  timelock: bigint | number;
  amount: bigint | number;
  tokenAddress: string;
}

export interface WithdrawHTLCParams {
  swapId: string;
  secret: `0x${string}` | Uint8Array;
}

export interface RefundHTLCParams {
  swapId: string;
}

// Order Parameters
export interface CreateOrderParams {
  sellToken: string;
  sellAmount: bigint | number;
  buyToken: string;
  buyAmount: bigint | number;
  targetChainId: number;
  targetAddress: string;
  minTimelock: number;
  expiresAt: number;
}

export interface MatchOrderParams {
  orderId: number | string;
  htlcSwapId: `0x${string}` | Uint8Array;
}

// Data Types
export interface SwapData {
  swapId: string;
  initiator: string;
  participant: string;
  amount: string;
  tokenAddress: string;
  hashlock: string;
  timelock: number;
  status: SwapStatus;
}

export enum SwapStatus {
  INVALID = 0,
  ACTIVE = 1,
  WITHDRAWN = 2,
  REFUNDED = 3,
}

export interface Order {
  id: number | string;
  creator: string;
  sellToken: string;
  sellAmount: string;
  sourceChainId: number;
  buyToken: string;
  buyAmount: string;
  targetChainId: number;
  targetAddress: string;
  minTimelock: number;
  expiresAt: number;
  status: OrderStatus;
  matchedBy?: string;
  htlcSwapId?: string;
}

export enum OrderStatus {
  ACTIVE = 0,
  MATCHED = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  EXPIRED = 4,
}

/**
 * Chain Adapter Interface
 *
 * All chain-specific implementations must implement this interface
 */
export interface ChainAdapter {
  // Chain identification
  readonly type: ChainType;
  readonly chainId: number | string;

  // HTLC Operations
  createHTLC(params: CreateHTLCParams): Promise<string>;
  withdrawHTLC(params: WithdrawHTLCParams): Promise<string>;
  refundHTLC(params: RefundHTLCParams): Promise<string>;
  getSwap(swapId: string): Promise<SwapData | null>;

  // Order Operations
  createOrder(params: CreateOrderParams): Promise<string>;
  matchOrder(params: MatchOrderParams): Promise<string>;
  cancelOrder(orderId: number | string): Promise<string>;
  getActiveOrders(targetChainId: number): Promise<Order[]>;
  getOrder(orderId: number | string): Promise<Order | null>;

  // Utility Functions
  isConnected(): boolean;
  getAddress(): string | undefined;
  getBalance(tokenAddress?: string): Promise<string>;
}

/**
 * Chain Adapter Error
 */
export class ChainAdapterError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'ChainAdapterError';
  }
}
