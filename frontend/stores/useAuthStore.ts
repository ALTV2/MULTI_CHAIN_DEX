import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
}

interface AuthActions {
  login: (token: string, userId: string, walletAddress: string, isNewUser: boolean) => void;
  logout: () => void;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      token: null,
      userId: null,
      walletAddress: null,
      isAuthenticated: false,
      isNewUser: false,

      login: (token, userId, walletAddress, isNewUser) =>
        set({
          token,
          userId,
          walletAddress: walletAddress.toLowerCase(),
          isAuthenticated: true,
          isNewUser,
        }),

      logout: () =>
        set({
          token: null,
          userId: null,
          walletAddress: null,
          isAuthenticated: false,
          isNewUser: false,
        }),

      getToken: () => get().token,
    }),
    {
      name: 'dex-auth',
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        walletAddress: state.walletAddress,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
