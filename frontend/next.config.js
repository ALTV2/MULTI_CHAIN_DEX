const fs = require('fs');
const path = require('path');

// Load RPC URL from ethereum/.env file
function loadSepoliaRpcUrl() {
  try {
    const envPath = path.join(__dirname, '../ethereum/.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/SEPOLIA_RPC_URL=(.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch (error) {
    console.warn('Could not read SEPOLIA_RPC_URL from ethereum/.env, using fallback');
  }
  return 'https://rpc.sepolia.org'; // Fallback to public RPC
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // Ignore React Native dependencies in browser builds
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
    };

    return config;
  },
  env: {
    // Automatically load SEPOLIA_RPC_URL from ethereum/.env
    NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || loadSepoliaRpcUrl(),
  },
};

module.exports = nextConfig;
