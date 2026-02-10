'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useAuthStore } from '@/stores/useAuthStore';
import { requestNonce, verifySignature } from '@/lib/api/auth';

export function useLogin() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const login = useAuthStore((s) => s.login);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { message, nonce } = await requestNonce(address);
      const signature = await signMessageAsync({ message });
      const response = await verifySignature(address, signature, nonce);
      login(response.token, response.userId, response.walletAddress, response.isNewUser);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      if (message.includes('User rejected') || message.includes('denied')) {
        setError('Signature rejected');
      } else {
        setError(message);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync, login]);

  return { signIn, isLoading, error };
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useCallback(() => {
    logout();
  }, [logout]);
}

export function useCurrentUser() {
  const { isAuthenticated, userId, walletAddress, isNewUser } = useAuthStore();
  return { isAuthenticated, userId, walletAddress, isNewUser };
}
