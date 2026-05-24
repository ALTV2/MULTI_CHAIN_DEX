import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SecretStorageMode = 'local' | 'show_once';

interface SettingsState {
  secretStorage: SecretStorageMode;
  defaultTargetWallets: Record<string, string>; // chainId → address
  /**
   * Opt-in email for off-chain swap-phase notifications. Sent to the backend
   * only when attaching order metadata — never stored on-chain. Empty = disabled.
   */
  notificationEmail: string;
}

interface SettingsActions {
  setSecretStorage: (mode: SecretStorageMode) => void;
  setDefaultTargetWallet: (chainId: string, address: string) => void;
  removeDefaultTargetWallet: (chainId: string) => void;
  getDefaultTargetWallet: (chainId: string) => string | undefined;
  setNotificationEmail: (email: string) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      secretStorage: 'show_once',
      defaultTargetWallets: {},
      notificationEmail: '',

      setSecretStorage: (mode) => set({ secretStorage: mode }),
      setNotificationEmail: (email) => set({ notificationEmail: email }),

      setDefaultTargetWallet: (chainId, address) =>
        set((state) => ({
          defaultTargetWallets: {
            ...state.defaultTargetWallets,
            [chainId]: address,
          },
        })),

      removeDefaultTargetWallet: (chainId) =>
        set((state) => {
          const { [chainId]: _, ...rest } = state.defaultTargetWallets;
          return { defaultTargetWallets: rest };
        }),

      getDefaultTargetWallet: (chainId) => get().defaultTargetWallets[chainId],
    }),
    {
      name: 'dex-settings',
    }
  )
);
