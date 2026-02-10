import type { SecretStorageStrategy } from './SecretStorageStrategy';

// Temporary in-memory store for current session only
const sessionSecrets = new Map<string, string>();

export class ShowOnceStrategy implements SecretStorageStrategy {
  async saveSecret(swapKey: string, secret: string): Promise<void> {
    // Store in memory for the current session only
    sessionSecrets.set(swapKey, secret);
  }

  async getSecret(swapKey: string): Promise<string | null> {
    return sessionSecrets.get(swapKey) ?? null;
  }

  async deleteSecret(swapKey: string): Promise<void> {
    sessionSecrets.delete(swapKey);
  }
}
