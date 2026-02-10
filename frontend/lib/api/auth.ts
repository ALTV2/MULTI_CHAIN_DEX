import { api } from './client';

interface NonceResponse {
  message: string;
  nonce: string;
}

interface AuthResponse {
  token: string;
  userId: string;
  walletAddress: string;
  isNewUser: boolean;
}

export async function requestNonce(walletAddress: string): Promise<NonceResponse> {
  return api.post<NonceResponse>('/auth/nonce', { walletAddress });
}

export async function verifySignature(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/verify', {
    walletAddress,
    signature,
    nonce,
  });
}
