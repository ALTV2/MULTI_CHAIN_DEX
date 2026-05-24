import { describe, it, expect } from 'vitest';
import { parseContractError, isUserRejection, CONTRACT_ERRORS } from './errors';

describe('parseContractError', () => {
  it('maps a known custom error to a friendly message', () => {
    const err = new Error("execution reverted with custom error 'SwapNotActive()'");
    expect(parseContractError(err)).toBe(CONTRACT_ERRORS.SwapNotActive);
  });
  it('falls back for an unknown custom error', () => {
    const err = new Error("reverted with custom error 'SomethingNew()'");
    expect(parseContractError(err)).toBe('Transaction failed: SomethingNew');
  });
  it('maps a reason string', () => {
    const err = new Error('Error: VM Exception reason="OrderNotActive"');
    expect(parseContractError(err)).toBe(CONTRACT_ERRORS.OrderNotActive);
  });
  it('detects user rejection', () => {
    expect(parseContractError(new Error('MetaMask Tx Signature: User denied transaction'))).toBe('Transaction was rejected');
  });
  it('detects insufficient funds', () => {
    expect(parseContractError(new Error('insufficient funds for gas'))).toBe('Insufficient balance for this transaction');
  });
  it('detects gas estimation failure', () => {
    expect(parseContractError(new Error('gas required exceeds allowance'))).toBe('Transaction would fail. Please check your inputs.');
  });
  it('returns a generic message for unrecognised errors', () => {
    expect(parseContractError(new Error('weird boom'))).toBe('Transaction failed. Please try again.');
  });
  it('handles null/undefined', () => {
    expect(parseContractError(null)).toBe('An unknown error occurred');
  });
  it('accepts a non-Error value', () => {
    expect(parseContractError('user rejected the request')).toBe('Transaction was rejected');
  });
});

describe('isUserRejection', () => {
  it('is true for rejection messages', () => {
    expect(isUserRejection(new Error('User rejected the request'))).toBe(true);
  });
  it('is false otherwise and for nullish', () => {
    expect(isUserRejection(new Error('nope'))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });
});
