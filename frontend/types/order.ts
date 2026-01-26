import type { Token } from './token';

export enum OrderStatus {
  Active = 0,
  Pending = 1,
  Completed = 2,
  Cancelled = 3,
}

export interface Order {
  id: bigint;
  creator: `0x${string}`;
  tokenToSell: `0x${string}`;
  tokenToBuy: `0x${string}`;
  sellAmount: bigint;
  buyAmount: bigint;
  status: OrderStatus;
}

export interface OrderDisplay extends Order {
  sellToken: Token;
  buyToken: Token;
  rate: number;
  inverseRate: number;
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Active:
      return 'Active';
    case OrderStatus.Pending:
      return 'Pending';
    case OrderStatus.Completed:
      return 'Completed';
    case OrderStatus.Cancelled:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

export function getOrderStatusColor(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Active:
      return 'bg-accent-green/10 text-accent-green border-accent-green/20';
    case OrderStatus.Pending:
      return 'bg-accent-orange/10 text-accent-orange border-accent-orange/20';
    case OrderStatus.Completed:
      return 'bg-accent-blue/10 text-accent-blue border-accent-blue/20';
    case OrderStatus.Cancelled:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}
