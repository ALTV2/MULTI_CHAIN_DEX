import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// ─── Mode (kept for reference / SUI provider) ─────────────────────────────────
export const CHAIN_MODE = (process.env.NEXT_PUBLIC_CHAIN_MODE || 'testnet') as 'testnet' | 'local';
export const IS_LOCAL = CHAIN_MODE === 'local';

// ─── Local chain definitions ──────────────────────────────────────────────────
// Anvil ETH  → port 8545, chainId 31337
// Anvil Poly → port 8546, chainId 31338
export const localEth = defineChain({
  id: 31337,
  name: 'Local Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_LOCAL_ETH_RPC_URL || 'http://127.0.0.1:8545'] },
  },
});

export const localPolygon = defineChain({
  id: 31338,
  name: 'Local Polygon',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_LOCAL_POLYGON_RPC_URL || 'http://127.0.0.1:8546'] },
  },
});

// ─── WalletConnect ─────────────────────────────────────────────────────────────
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'Multi-Chain DEX' }),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

// ─── Wagmi config — all 4 EVM chains always available ────────────────────────
export const config = createConfig({
  chains: [localEth, localPolygon, sepolia, polygonAmoy],
  connectors,
  transports: {
    [localEth.id]:     http(process.env.NEXT_PUBLIC_LOCAL_ETH_RPC_URL     || 'http://127.0.0.1:8545'),
    [localPolygon.id]: http(process.env.NEXT_PUBLIC_LOCAL_POLYGON_RPC_URL || 'http://127.0.0.1:8546'),
    [sepolia.id]:      http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL       || 'https://rpc.sepolia.org'),
    [polygonAmoy.id]:  http(process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL  || 'https://rpc-amoy.polygon.technology'),
  },
  ssr: true,
});

// ─── All supported EVM chains ─────────────────────────────────────────────────
export const supportedChains = [localEth, localPolygon, sepolia, polygonAmoy] as const;

export type SupportedChain = (typeof supportedChains)[number];
