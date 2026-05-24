import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatAddress,
  formatNumber,
  formatTokenAmount,
  formatTimeAgo,
  copyToClipboard,
} from './formatters';

describe('formatAddress', () => {
  it('truncates with default 4 chars', () => {
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });
  it('honours a custom char count', () => {
    expect(formatAddress('0xabcdefabcdef', 2)).toBe('0xab...ef');
  });
  it('returns empty string for empty input', () => {
    expect(formatAddress('')).toBe('');
  });
});

describe('formatNumber', () => {
  it('returns "0" for zero and NaN', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber('not-a-number')).toBe('0');
  });
  it('returns "< 0.0001" for tiny positive values', () => {
    expect(formatNumber(0.00005)).toBe('< 0.0001');
  });
  it('abbreviates millions and thousands', () => {
    expect(formatNumber(2_500_000)).toBe('2.50M');
    expect(formatNumber(1500)).toBe('1.50K');
  });
  it('strips trailing zeros', () => {
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(2)).toBe('2');
  });
  it('parses string input', () => {
    expect(formatNumber('42.1000')).toBe('42.1');
  });
});

describe('formatTokenAmount', () => {
  it('formats a bigint with decimals', () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe('1.5');
  });
  it('accepts a string amount', () => {
    expect(formatTokenAmount('1000000000000000000', 18)).toBe('1');
  });
  it('returns "0" on invalid input', () => {
    expect(formatTokenAmount('not-a-bigint', 18)).toBe('0');
  });
});

describe('formatTimeAgo', () => {
  it('formats days/hours/minutes/now from a unix-seconds timestamp', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(nowSec - 2 * 86400)).toBe('2d ago');
    expect(formatTimeAgo(nowSec - 3 * 3600)).toBe('3h ago');
    expect(formatTimeAgo(nowSec - 5 * 60)).toBe('5m ago');
    expect(formatTimeAgo(nowSec)).toBe('Just now');
  });
  it('accepts a bigint timestamp', () => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    expect(formatTimeAgo(nowSec - 86400n)).toBe('1d ago');
  });
});

describe('copyToClipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('delegates to navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });
});
