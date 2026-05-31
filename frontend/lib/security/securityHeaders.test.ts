import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { buildCsp, securityHeaders } from './securityHeaders';

/**
 * C-XSS: a strict Content-Security-Policy shrinks the blast radius of an XSS / malicious
 * dependency that would otherwise drive the connected wallet. The shipped CSP must forbid
 * eval, deny framing/clickjacking, and lock object/base-uri.
 */
describe('Content-Security-Policy (C-XSS)', () => {
  const csp = buildCsp();

  it('locks the default source to self', () => {
    expect(csp).toMatch(/default-src 'self'/);
  });
  it("must NOT allow 'unsafe-eval' anywhere (string-to-code is the dangerous primitive)", () => {
    // 'unsafe-inline' is tolerated for Next.js hydration, but 'unsafe-eval' must never appear.
    expect(csp).not.toMatch(/unsafe-eval/);
  });
  it('denies clickjacking via frame-ancestors none', () => {
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });
  it('locks object-src and base-uri', () => {
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
  });
  it('still allows wallet/RPC connections (https/wss)', () => {
    expect(csp).toMatch(/connect-src[^;]*https:/);
    expect(csp).toMatch(/connect-src[^;]*wss:/);
  });
  it('allows the WalletConnect verification iframe (so the wallet modal works)', () => {
    expect(csp).toMatch(/frame-src[^;]*verify\.walletconnect\.(com|org)/);
  });

  it('exposes the CSP plus hardening headers to Next', () => {
    const headers = securityHeaders();
    const keys = headers.map((h: { key: string }) => h.key);
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).toContain('X-Frame-Options');
    expect(keys).toContain('X-Content-Type-Options');
  });
});
