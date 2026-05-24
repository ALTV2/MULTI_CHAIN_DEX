import type { SecretStorageMode } from '@/stores/useSettingsStore';
import type { SecretStorageStrategy } from './SecretStorageStrategy';
import { LocalStorageStrategy } from './LocalStorageStrategy';
import { ShowOnceStrategy } from './ShowOnceStrategy';

export { buildSwapKey } from './SecretStorageStrategy';
export type { SecretStorageStrategy } from './SecretStorageStrategy';

const strategies: Record<SecretStorageMode, SecretStorageStrategy> = {
  local: new LocalStorageStrategy(),
  show_once: new ShowOnceStrategy(),
};

export function getSecretStrategy(mode: SecretStorageMode): SecretStorageStrategy {
  return strategies[mode];
}
