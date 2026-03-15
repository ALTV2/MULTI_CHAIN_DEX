export interface SecretStorageStrategy {
  saveSecret(swapKey: string, secret: string): Promise<void>;
  getSecret(swapKey: string): Promise<string | null>;
  deleteSecret(swapKey: string): Promise<void>;
}

export function buildSwapKey(walletAddress: string, orderId: string, chainId: number | string): string {
  return `${walletAddress.toLowerCase()}_${orderId}_${chainId}`;
}
