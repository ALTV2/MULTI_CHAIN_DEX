# Multi-Chain DEX

A decentralized exchange supporting **cross-chain atomic swaps** between Ethereum (Sepolia) and Polygon (Amoy) using Hash Time-Locked Contracts (HTLC).

## Architecture

```
MULTI_CHAIN_DEX/
├── frontend/         Next.js 14 + wagmi v2 + viem + Tailwind + Zustand
├── backend/          Spring Boot 3.3 + JPA + Flyway + JWT auth (optional)
├── ethereum/         Hardhat — HTLC + CrossChainOrderBook (Sepolia)
├── polygon/          Hardhat — HTLC + CrossChainOrderBook (Amoy)
└── docs/             Guides (e.g. adding a new chain)
```

### How it works

1. **Order Discovery** — users browse cross-chain orders stored on-chain via `CrossChainOrderBook`
2. **Order Matching** — a counterparty matches an order and an HTLC swap flow begins
3. **HTLC Swap** — initiator locks funds on source chain; counterparty locks on target chain with the same hashlock
4. **Atomic Execution** — initiator withdraws on target chain (reveals secret); counterparty uses the revealed secret to withdraw on source chain
5. **Fallback** — after timelock expiry either party can reclaim their funds via `refund()`

The backend is **optional** — all swap logic works fully on-chain. The backend provides user accounts, swap history persistence, and encrypted secret storage.

## Quick Start

### Prerequisites

- Node.js >= 18
- Java 21 + Maven (for backend)
- MetaMask or another EVM browser wallet
- Sepolia ETH and Polygon Amoy MATIC (testnet faucets)

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # add your RPC URLs
npm install
npm run dev                         # http://localhost:3000
```

### Backend (optional)

```bash
cd backend
# Requires PostgreSQL — see docker-compose.yml
docker-compose up -d db
./mvnw spring-boot:run
```

### Smart Contracts

```bash
# Ethereum (Sepolia)
cd ethereum
npm install
npx hardhat test
npx hardhat run scripts/deploy-htlc.js --network sepolia

# Polygon (Amoy)
cd polygon
npm install
npx hardhat test
npx hardhat run scripts/deploy-htlc.js --network polygonAmoy
```

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC endpoint | No (has public fallback) |
| `NEXT_PUBLIC_POLYGON_AMOY_RPC_URL` | Polygon Amoy RPC endpoint | No (has public fallback) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID | No (MetaMask works without it) |
| `NEXT_PUBLIC_API_URL` | Backend API URL | No (auth features disabled without it) |

### Backend (`backend/application.yml`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_URL` | PostgreSQL JDBC URL | Yes |
| `DB_USERNAME` / `DB_PASSWORD` | Database credentials | Yes |
| `JWT_SECRET` | JWT signing secret (>= 32 chars) | Yes |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origin | Yes |

## Deployed Contract Addresses

### Ethereum Sepolia (chainId: 11155111)

| Contract | Address |
|----------|---------|
| HTLC | `0x9aB954f470cc7196C0803bE44b1d58e762a48964` |
| CrossChainOrderBook | `0x6A78740f7D35818D30e23ebD5A5880A1836aa445` |
| OrderBook | `0x96c763c1Cb33e5be34c20980570Fe1614F3df05e` |
| Trade | `0x125B8201BFB93337b298Dc650F9729a2aa7E2061` |
| TestTokenA | `0x16eb4f1a13dC130074360a14ec5ee01632e87584` |
| TestTokenB | `0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644` |

### Polygon Amoy (chainId: 80002)

| Contract | Address |
|----------|---------|
| HTLC | `0x3d857Fc3510246A050817C29ea7C434ab7EbA81A` |
| CrossChainOrderBook | `0x5F08Ec67A95C4394d577c90c65083AEb119BD922` |
| OrderBook | `0x22763589e1dd35d1FE86c51B0593E71677d72054` |
| Trade | `0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5` |
| TestTokenA | `0x711F11CfeD1D00f981BdA0E7B892dDa6f2EA47c5` |
| TestTokenB | `0xCADe258E49B605cEaCe568A688893589D8E72907` |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — hero section, stats, CTAs |
| `/orders` | Unified cross-chain order book — browse, create, and match orders |
| `/swap` | Active swaps management — track HTLC progress, reveal secrets |
| `/profile` | User profile — overview, wallets, swap history, settings |
| `/trade` | Legacy single-chain trading (kept for compatibility) |

## Adding a New Blockchain

See [docs/ADD_NEW_CHAIN.md](docs/ADD_NEW_CHAIN.md) for a step-by-step guide.

## Tech Stack

**Frontend:** Next.js 14 (App Router), TypeScript, wagmi v2, viem, Tailwind CSS, Zustand, React Query, sonner, next-intl (EN/RU)

**Backend:** Spring Boot 3.3, Java 21, Spring Data JPA, Flyway, PostgreSQL, JWT (jjwt), Swagger/OpenAPI

**Contracts:** Solidity 0.8.20, Hardhat, OpenZeppelin (ReentrancyGuard, SafeERC20, Ownable)

## License

MIT
