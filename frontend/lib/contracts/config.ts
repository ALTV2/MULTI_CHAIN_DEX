import { http, createConfig } from 'wagmi';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// RPC for wagmi transport — used ONLY for balance checks, allowance reads, and tx signing.
// All order/swap data reads go through the backend API.
const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const polygonRpc = process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';

const connectors = [
  injected(),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

export const config = createConfig({
  chains: [sepolia, polygonAmoy],
  connectors,
  transports: {
    [sepolia.id]: http(sepoliaRpc, { batch: false }),
    [polygonAmoy.id]: http(polygonRpc, { batch: false }),
  },
  batch: { multicall: false },
  pollingInterval: 120_000,
  ssr: true,
});

export const supportedChains = [sepolia, polygonAmoy] as const;
export type SupportedChain = (typeof supportedChains)[number];
