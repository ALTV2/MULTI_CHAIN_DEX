/**
 * Security headers (C-XSS fix).
 *
 * A strict Content-Security-Policy is the main structural control limiting what an XSS
 * payload or a trojaned dependency can do once it runs in the dApp origin. Notably it
 * forbids `unsafe-eval`, denies framing (clickjacking), and locks object-src/base-uri.
 * connect-src stays permissive for https/wss because wallets and RPC providers
 * (Alchemy, WalletConnect relays) connect to many endpoints.
 *
 * Plain JS (allowJs) so it is the single source of truth shared by next.config.js and tests.
 */
function buildCsp() {
  const directives = [
    "default-src 'self'",
    // 'unsafe-inline' is required because Next.js (App Router) injects inline bootstrap/hydration
    // scripts and we have no nonce pipeline yet; a nonce-based policy (middleware + per-request nonce)
    // is the hardening upgrade path. We DELIBERATELY still forbid 'unsafe-eval', which is the more
    // dangerous primitive (string-to-code) and is not needed by Next/wagmi in production.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // Wallets / RPC providers (Alchemy, WalletConnect relay) open many https/wss endpoints.
    "connect-src 'self' https: wss:",
    // WalletConnect/RainbowKit embed a verification iframe; allow only those origins (and self).
    "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
    // We never want to BE framed (clickjacking) regardless of what we may embed above.
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join('; ');
}

function securityHeaders() {
  return [
    { key: 'Content-Security-Policy', value: buildCsp() },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  ];
}

module.exports = { buildCsp, securityHeaders };
