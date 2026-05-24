/**
 * DEX Backend API client.
 * All blockchain reads go through this — no direct Alchemy/RPC calls from frontend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v2';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('API request timeout (15s)');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface ChainDto {
  id: string;
  name: string;
  shortName: string;
  chainType: 'EVM' | 'SUI';
  blockExplorer: string;
  nativeSymbol: string;
  nativeDecimals: number;
  contracts: Record<string, string>;
}

export interface TokenDto {
  id: string;
  chainId: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
}

export interface TokenInfoDto {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
}

export interface OrderDto {
  id: string;
  sourceChainId: string;
  onChainOrderId: string;
  orderType: 'SAME_CHAIN' | 'CROSS_CHAIN';
  creator: string;
  matcher: string | null;
  sellToken: TokenInfoDto | null;
  sellAmount: string;
  formattedSellAmount: string;
  buyToken: TokenInfoDto | null;
  buyAmount: string;
  formattedBuyAmount: string;
  targetChainId: string | null;
  targetAddress: string | null;
  status: string;
  phase: string;
  expiresAt: number | null;
  createdAt: string;
  matchedAt: string | null;
  completedAt: string | null;
  suiSameChainMeta: {
    orderObjectId: string;
    coinAType: string;
    coinBType: string;
    pairId: string;
  } | null;
}

export interface HtlcInfoDto {
  chainId: string;
  onChainSwapId: string | null;
  suiObjectId: string | null;
  status: string;
  hashlock: string | null;
  timelock: number | null;
  token: TokenInfoDto | null;
  amount: string | null;
  creationTxHash: string | null;
  withdrawTxHash: string | null;
  createdAt: string | null;
}

export interface SwapDto {
  order: OrderDto;
  role: string;
  phase: string;
  creatorHtlc: HtlcInfoDto | null;
  matcherHtlc: HtlcInfoDto | null;
  revealedSecret: string | null;
}

export interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

// ── API calls ─────────────────────────────────────────────────────────

export function fetchChains(): Promise<ChainDto[]> {
  return fetchJson('/chains');
}

export function fetchTokens(chainId?: string): Promise<TokenDto[]> {
  const q = chainId ? `?chainId=${chainId}` : '';
  return fetchJson(`/tokens${q}`);
}

export function fetchOrders(params: {
  status?: string;
  sourceChain?: string;
  targetChain?: string;
  orderType?: string;
  sellToken?: string;
  buyToken?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageDto<OrderDto>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.sourceChain) q.set('sourceChain', params.sourceChain);
  if (params.targetChain) q.set('targetChain', params.targetChain);
  if (params.orderType) q.set('orderType', params.orderType);
  if (params.sellToken) q.set('sellToken', params.sellToken);
  if (params.buyToken) q.set('buyToken', params.buyToken);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 50));
  return fetchJson(`/orders?${q}`);
}

export function fetchMyOrders(params: {
  wallets: string[];
  status?: string;
  role?: string;
  page?: number;
  size?: number;
}): Promise<PageDto<OrderDto>> {
  const q = new URLSearchParams();
  params.wallets.forEach(w => q.append('wallet', w));
  if (params.status) q.set('status', params.status);
  if (params.role) q.set('role', params.role);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 50));
  return fetchJson(`/orders/my?${q}`);
}

export function fetchActiveSwaps(wallets: string[]): Promise<SwapDto[]> {
  const q = new URLSearchParams();
  wallets.forEach(w => q.append('wallet', w));
  return fetchJson(`/swaps/active?${q}`);
}

export function fetchSwapHistory(params: {
  wallets: string[];
  page?: number;
  size?: number;
}): Promise<PageDto<SwapDto>> {
  const q = new URLSearchParams();
  params.wallets.forEach(w => q.append('wallet', w));
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return fetchJson(`/swaps/history?${q}`);
}

export interface OrderMetadataRequest {
  /** Source chain ID where the order lives, e.g. "11155111" or "sui:testnet". */
  chainId: string;
  /** On-chain order ID (decimal string). */
  onChainOrderId: string;
  orderType: 'SAME_CHAIN' | 'CROSS_CHAIN';
  role: 'creator' | 'matcher';
  /** Full target-side address — may exceed the on-chain field (e.g. a 32-byte SUI address). */
  targetAddress?: string;
  /** Opt-in notification email — stored off-chain only. */
  email?: string;
}

/**
 * Attach off-chain metadata (full target address + opt-in email) to an order.
 * Best-effort: the backend forces an index cycle if the order is not yet present.
 * Returns true if the metadata was attached (HTTP 200), false otherwise.
 */
export async function attachOrderMetadata(req: OrderMetadataRequest): Promise<boolean> {
  try {
    await fetchJson('/orders/metadata', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    return true;
  } catch {
    return false;
  }
}

export function notifyTransaction(data: {
  chainId: string;
  txHash: string;
  type: string;
  orderId?: string;
  wallet?: string;
}): Promise<void> {
  return fetchJson('/tx/notify', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(() => {});
}
