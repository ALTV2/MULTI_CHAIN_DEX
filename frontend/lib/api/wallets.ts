import { api } from './client';

export interface WalletResponse {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  imported: boolean;
  isPrimary: boolean;
  hasPrivateKey: boolean;
  createdAt: string;
}

interface AddWalletRequest {
  address: string;
  chain: string;
  label?: string;
}

export async function getWallets(): Promise<WalletResponse[]> {
  return api.get<WalletResponse[]>('/wallet');
}

export async function getWalletsByChain(chain: string): Promise<WalletResponse[]> {
  return api.get<WalletResponse[]>(`/wallet/chain/${chain}`);
}

export async function addWallet(req: AddWalletRequest): Promise<WalletResponse> {
  return api.post<WalletResponse>('/wallet', req);
}

export async function removeWallet(walletId: string): Promise<void> {
  return api.delete(`/wallet/${walletId}`);
}

export async function updateWalletLabel(
  walletId: string,
  label: string
): Promise<WalletResponse> {
  return api.patch<WalletResponse>(`/wallet/${walletId}/label`, { label });
}

export async function setPrimaryWallet(walletId: string): Promise<void> {
  return api.post(`/wallet/${walletId}/primary`);
}
