import type { SecretStorageStrategy } from './SecretStorageStrategy';

const PREFIX = 'dex_secret_';

export class LocalStorageStrategy implements SecretStorageStrategy {
  async saveSecret(swapKey: string, secret: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${PREFIX}${swapKey}`, secret);
  }

  async getSecret(swapKey: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`${PREFIX}${swapKey}`);
  }

  async deleteSecret(swapKey: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${PREFIX}${swapKey}`);
  }
}
