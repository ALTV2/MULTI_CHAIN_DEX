import { http, createConfig } from 'wagmi';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// RPC URLs
const sepoliaRpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  'https://rpc.sepolia.org';

const polygonAmoyRpcUrl =
  process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ||
  'https://rpc-amoy.polygon.technology';

// Connectors - conditionally include walletConnect if projectId is set
const connectors = [
  injected(),
  coinbaseWallet({ appName: 'Multi-Chain DEX' }),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

export const config = createConfig({
  chains: [sepolia, polygonAmoy],
  connectors,
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl, { batch: false }),
    [polygonAmoy.id]: http(polygonAmoyRpcUrl, { batch: false }),
  },
  batch: { multicall: false }, // Disable Multicall3 batching — we do manual fetches
  pollingInterval: 120_000, // 2 minutes — reduce Alchemy RPC load (default was 4s)
  ssr: true,
});

// Export supported chains for use in components
export const supportedChains = [sepolia, polygonAmoy] as const;
export type SupportedChain = (typeof supportedChains)[number];
