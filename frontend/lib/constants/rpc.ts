import { sepolia, polygonAmoy } from 'wagmi/chains';

export const RPC_URLS: Record<number, string> = {
  [sepolia.id]: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
  [polygonAmoy.id]: process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
};

export const CHAIN_MAP: Record<number, typeof sepolia | typeof polygonAmoy> = {
  [sepolia.id]: sepolia,
  [polygonAmoy.id]: polygonAmoy,
};
