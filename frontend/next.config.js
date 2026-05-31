/** @type {import('next').NextConfig} */
const { securityHeaders } = require('./lib/security/securityHeaders');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // C-XSS: strict security headers (CSP, anti-clickjacking, nosniff) on every route
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
    };

    return config;
  },
  env: {
    NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
  },
};

module.exports = nextConfig;
