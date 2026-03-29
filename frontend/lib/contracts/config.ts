import { http, createConfig } from 'wagmi';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'Multi-Chain DEX' }),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

export const config = createConfig({
  chains: [sepolia, polygonAmoy],
  connectors,
  transports: {
    // Public RPCs — used only for balance checks and tx confirmation via wallet.
    // All blockchain reads go through backend API, not these transports.
    [sepolia.id]: http('https://rpc.sepolia.org', { batch: false }),
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology', { batch: false }),
  },
  batch: { multicall: false },
  pollingInterval: 120_000,
  ssr: true,
});

export const supportedChains = [sepolia, polygonAmoy] as const;
export type SupportedChain = (typeof supportedChains)[number];
