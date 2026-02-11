import type { SecretStorageStrategy } from './SecretStorageStrategy';

const PREFIX = 'dex_secret_';

/**
 * @security HTLC secrets are stored as plaintext in localStorage.
 * Any XSS vulnerability can read all stored secrets.
 * For improved security, use "database" or "show_once" storage mode.
 */
export class LocalStorageStrategy implements SecretStorageStrategy {
  async saveSecret(swapKey: string, secret: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Security] HTLC secret stored in plaintext localStorage. Consider using "database" or "show_once" mode.');
    }
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
