import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID is optional - only needed for WalletConnect/mobile wallets
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// RPC URL: Try to read from environment, fallback to public RPC
// In production, this should be loaded from ethereum/.env via build process
const sepoliaRpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  'https://eth-sepolia.g.alchemy.com/v2/VPxg_-3LrpC7xW0yO-AGi'; // From ethereum/.env

// Build connectors list - include WalletConnect only if projectId is provided
// Note: injected() covers MetaMask, Brave Wallet, and all browser extension wallets
const connectors = [
  injected(),
  coinbaseWallet({ appName: 'Multi-Chain DEX' }),
];

// Add WalletConnect only if project ID is available
if (projectId) {
  connectors.push(walletConnect({ projectId }));
}

export const config = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
  },
  ssr: true,
});
