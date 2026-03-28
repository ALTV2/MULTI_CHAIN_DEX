import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SecretStorageMode = 'local' | 'database' | 'show_once';

interface SettingsState {
  secretStorage: SecretStorageMode;
  autoUpdate: boolean;
  defaultTargetWallets: Record<string, string>; // chainId → address
}

interface SettingsActions {
  setSecretStorage: (mode: SecretStorageMode) => void;
  setAutoUpdate: (enabled: boolean) => void;
  setDefaultTargetWallet: (chainId: string, address: string) => void;
  removeDefaultTargetWallet: (chainId: string) => void;
  getDefaultTargetWallet: (chainId: string) => string | undefined;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      secretStorage: 'show_once',
      autoUpdate: false,
      defaultTargetWallets: {},

      setSecretStorage: (mode) => set({ secretStorage: mode }),
      setAutoUpdate: (enabled) => set({ autoUpdate: enabled }),

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
