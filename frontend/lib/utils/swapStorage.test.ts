// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSwaps,
  getSwap,
  saveSwap,
  updateSwap,
  removeSwap,
  getSecret,
  clearWalletSwaps,
  clearAllSwaps,
  cleanupAllFakeOrders,
} from './swapStorage';
import type { StoredSwapMeta } from '@/types/swap';

const WALLET = '0xAbCdef0000000000000000000000000000000001';

function swap(overrides: Partial<StoredSwapMeta> = {}): StoredSwapMeta {
  return {
    orderId: '1',
    role: 'creator',
    sourceChainId: 11155111,
    targetChainId: 80002,
    hashlock: '0x',
    sellToken: '0xsell',
    sellAmount: '1',
    buyToken: '0xbuy',
    buyAmount: '1',
    creator: '0xcreator',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe('swapStorage', () => {
  it('returns [] when nothing stored', () => {
    expect(getSwaps(WALLET)).toEqual([]);
  });

  it('saves and reads back a swap (case-insensitive wallet key)', () => {
    saveSwap(WALLET, swap({ secret: '0xsecret' }));
    const read = getSwaps(WALLET.toLowerCase());
    expect(read).toHaveLength(1);
    expect(read[0].orderId).toBe('1');
    expect(getSecret(WALLET, '1', 11155111)).toBe('0xsecret');
  });

  it('updates an existing swap in place (matched by orderId + sourceChainId)', () => {
    saveSwap(WALLET, swap());
    updateSwap(WALLET, '1', { matcher: '0xm' }, 11155111);
    expect(getSwap(WALLET, '1', 11155111)?.matcher).toBe('0xm');
    expect(getSwaps(WALLET)).toHaveLength(1);
  });

  it('updateSwap is a no-op for an unknown order', () => {
    updateSwap(WALLET, '999', { matcher: '0xm' });
    expect(getSwaps(WALLET)).toEqual([]);
  });

  it('keeps swaps with the same orderId on different chains distinct', () => {
    saveSwap(WALLET, swap({ orderId: '5', sourceChainId: 11155111 }));
    saveSwap(WALLET, swap({ orderId: '5', sourceChainId: 80002 }));
    expect(getSwaps(WALLET)).toHaveLength(2);
  });

  it('removes a swap', () => {
    saveSwap(WALLET, swap());
    removeSwap(WALLET, '1', 11155111);
    expect(getSwaps(WALLET)).toEqual([]);
  });

  it('filters out fake timestamp-id orders on read', () => {
    localStorage.setItem(
      `dex_swaps_${WALLET.toLowerCase()}`,
      JSON.stringify([swap({ orderId: '1771171412345' }), swap({ orderId: '2' })])
    );
    const read = getSwaps(WALLET);
    expect(read).toHaveLength(1);
    expect(read[0].orderId).toBe('2');
  });

  it('returns [] for malformed JSON', () => {
    localStorage.setItem(`dex_swaps_${WALLET.toLowerCase()}`, '{not json');
    expect(getSwaps(WALLET)).toEqual([]);
  });

  it('clearWalletSwaps removes only that wallet', () => {
    saveSwap(WALLET, swap());
    saveSwap('0x00000000000000000000000000000000000000ff', swap({ orderId: '3' }));
    clearWalletSwaps(WALLET);
    expect(getSwaps(WALLET)).toEqual([]);
    expect(getSwaps('0x00000000000000000000000000000000000000ff')).toHaveLength(1);
  });

  it('clearAllSwaps wipes every wallet', () => {
    saveSwap(WALLET, swap());
    saveSwap('0x00000000000000000000000000000000000000ff', swap({ orderId: '3' }));
    clearAllSwaps();
    expect(getSwaps(WALLET)).toEqual([]);
    expect(getSwaps('0x00000000000000000000000000000000000000ff')).toEqual([]);
  });

  it('cleanupAllFakeOrders strips timestamp-id orders across keys', () => {
    localStorage.setItem(
      `dex_swaps_${WALLET.toLowerCase()}`,
      JSON.stringify([swap({ orderId: '1771171412345' }), swap({ orderId: '7' })])
    );
    cleanupAllFakeOrders();
    expect(getSwaps(WALLET)).toHaveLength(1);
    expect(getSwaps(WALLET)[0].orderId).toBe('7');
  });
});
