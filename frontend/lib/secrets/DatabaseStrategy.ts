import type { SecretStorageStrategy } from './SecretStorageStrategy';
import { useAuthStore } from '@/stores/useAuthStore';
import { saveSwapSecret, getSwapSecret } from '@/lib/api/swaps';
import { LocalStorageStrategy } from './LocalStorageStrategy';

const fallback = new LocalStorageStrategy();

export class DatabaseStrategy implements SecretStorageStrategy {
  async saveSecret(swapKey: string, secret: string): Promise<void> {
    const isAuth = useAuthStore.getState().isAuthenticated;
    if (!isAuth) {
      return fallback.saveSecret(swapKey, secret);
    }
    try {
      await saveSwapSecret(swapKey, secret);
    } catch {
      // Fall back to localStorage if API fails
      await fallback.saveSecret(swapKey, secret);
    }
  }

  async getSecret(swapKey: string): Promise<string | null> {
    const isAuth = useAuthStore.getState().isAuthenticated;
    if (!isAuth) {
      return fallback.getSecret(swapKey);
    }
    try {
      const result = await getSwapSecret(swapKey);
      if (result?.encryptedSecret) return result.encryptedSecret;
    } catch {
      // Fall back to localStorage
    }
    return fallback.getSecret(swapKey);
  }

  async deleteSecret(swapKey: string): Promise<void> {
    await fallback.deleteSecret(swapKey);
  }
}
