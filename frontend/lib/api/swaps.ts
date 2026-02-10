import { api } from './client';

export interface SwapHistoryResponse {
  id: string;
  htlcSwapId: string | null;
  crossChainOrderId: string | null;
  sourceChain: string;
  targetChain: string;
  sourceToken: string | null;
  sourceAmount: string;
  targetToken: string | null;
  targetAmount: string;
  status: string;
  sourceTxHash: string | null;
  targetTxHash: string | null;
  hashlock: string | null;
  timelockExpiry: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface CreateSwapRequest {
  sourceChain: string;
  targetChain: string;
  sourceToken?: string;
  sourceAmount: string;
  targetToken?: string;
  targetAmount: string;
  hashlock?: string;
  timelockExpiry?: string;
}

interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export async function createSwapRecord(req: CreateSwapRequest): Promise<SwapHistoryResponse> {
  return api.post<SwapHistoryResponse>('/swap', req);
}

export async function getSwapHistory(
  page = 0,
  size = 20
): Promise<PageResponse<SwapHistoryResponse>> {
  return api.get<PageResponse<SwapHistoryResponse>>(`/swap/history?page=${page}&size=${size}`);
}

export async function getActiveSwaps(): Promise<SwapHistoryResponse[]> {
  return api.get<SwapHistoryResponse[]>('/swap/active');
}

export async function getSwapById(swapId: string): Promise<SwapHistoryResponse> {
  return api.get<SwapHistoryResponse>(`/swap/${swapId}`);
}

export async function updateSwapStatus(
  swapId: string,
  status: string,
  txHash?: string,
  isSourceTx?: boolean
): Promise<SwapHistoryResponse> {
  return api.patch<SwapHistoryResponse>(`/swap/${swapId}/status`, {
    status,
    txHash,
    isSourceTx,
  });
}

export async function updateHtlcSwapId(
  swapId: string,
  htlcSwapId: string
): Promise<SwapHistoryResponse> {
  return api.patch<SwapHistoryResponse>(`/swap/${swapId}/htlc`, { htlcSwapId });
}

export async function saveSwapSecret(
  swapId: string,
  encryptedSecret: string
): Promise<void> {
  return api.post(`/swap/${swapId}/secret`, { encryptedSecret });
}

export async function getSwapSecret(
  swapId: string
): Promise<{ encryptedSecret: string } | null> {
  try {
    return await api.get<{ encryptedSecret: string }>(`/swap/${swapId}/secret`);
  } catch {
    return null;
  }
}
