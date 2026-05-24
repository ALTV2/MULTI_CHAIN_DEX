# Multi-Chain DEX

A **non-custodial** decentralized exchange for **cross-chain atomic swaps** between
heterogeneous distributed ledgers — Ethereum (Sepolia), Polygon (Amoy) and **SUI**
(testnet) — using Hash Time-Locked Contracts (HTLC) and an on-chain order book.
No bridges, no oracles, no trusted intermediaries; the HTLC secret never leaves the
user's browser.

## Architecture

```
MULTI_CHAIN_DEX/
├── frontend/          Next.js 14 · wagmi/viem · @mysten/dapp-kit (Slush) · Tailwind · Zustand
├── backend/           Maven multi-module (Spring Boot 3.3 · Java 21)
│   ├── indexer-service/        Blockchain indexer + public REST API (PostgreSQL)
│   └── notification-service/   Kafka consumer → Thymeleaf/SMTP email notifications
├── ethereum/          Hardhat — HTLC, CrossChainOrderBook, OrderBook, Trade (Sepolia)
├── polygon/           Hardhat config for Polygon Amoy (same contract set)
├── sui/               Move — htlc, cross_chain_order_book, order_book, trade
├── k8s/local/         Kind (Kubernetes-in-Docker) manifests for the full stack
└── docs/              Architecture notes & thesis material (git-ignored)
```

### How it works

The protocol runs in **eight phases** (a two-party HTLC swap between registries A and B):

1. **ORDER_CREATED** — the creator posts a cross-chain order on `CrossChainOrderBook` (registry A). No funds locked yet.
2. **ORDER_MATCHED** — a counterparty reserves the order.
3. **CREATOR_HTLC_CREATED** — the creator locks the sell tokens in an HTLC on A with timelock T₁ (hash of a secret only they hold).
4. **MATCHER_HTLC_CREATED** — the matcher locks the buy tokens in a counter-HTLC on B with the same hash and a shorter timelock T₂.
5. **SECRET_REVEALED** — the creator withdraws on B, publishing the secret on-chain.
6. **COMPLETED** — the matcher reads the revealed secret and withdraws on A.
7–8. **REFUNDABLE / REFUNDED** — if a timelock expires, the locking party reclaims its funds.

The **indexer-service** polls all registries (Web3j for EVM, JSON-RPC for SUI), stores
orders/swaps in PostgreSQL, and computes the current phase server-side (`PhaseCalculator`,
zero RPC). The **REST API is fully public and read-only by design** — all data derives from
public on-chain state. On a phase change it publishes an event to **Apache Kafka**; the
**notification-service** consumes it and sends an opt-in email (the email is passed off-chain
via `POST /api/v2/orders/metadata` and stored only in the database, never on-chain).

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js 14 (App Router), TypeScript, wagmi v2, viem, `@mysten/sui` + `@mysten/dapp-kit` (Slush), Tailwind, Zustand, React Query, Vitest |
| Backend | Spring Boot 3.3, Java 21, Spring Data JPA, Liquibase, PostgreSQL 16, Spring Kafka, Thymeleaf, springdoc-openapi, JaCoCo |
| Contracts | Solidity 0.8.20 + Hardhat + OpenZeppelin (EVM); Move + `sui move` (SUI) |
| Infra | Docker, Apache Kafka 3.7 (KRaft), Kubernetes (Kind), ingress-nginx, Mailpit |
| Analysis | Slither, solidity-coverage, `sui move test --coverage` |

## Quick local start

**Prerequisites:** Docker, a browser wallet (MetaMask + Slush), and ideally your own Alchemy
RPC keys for Sepolia/Amoy (the public demo endpoints have tight rate limits).

### Option A — Docker Compose (recommended)

The full stack — Postgres, Kafka, Mailpit, indexer, notification and frontend — in one command:

```bash
cp .env.example .env          # add your SEPOLIA_RPC_URL / POLYGON_RPC_URL
docker compose up --build     # → http://localhost:3000 (UI), http://localhost:8025 (Mailpit)
docker compose down           # tear everything down
```

### Option B — Kubernetes (Kind) — production-like

Single command via `./scripts/dev-up.sh`, or follow **[k8s/local/README.md](k8s/local/README.md)**
for the manual walkthrough (create cluster → install ingress → build & `kind load` images →
apply manifests). Access at `http://dex.localhost` once you add it to `/etc/hosts`.

### Option C — dev iteration (hot reload, no containers)

Run pieces directly on the host for fast feedback (frontend hot reload, backend logs visible):

```bash
# infra only in Docker
docker compose up -d db kafka mailpit
# backend (Java 21) — terminals #1 and #2
cd backend
SEPOLIA_RPC_URL=... POLYGON_RPC_URL=... mvn -pl indexer-service      spring-boot:run
                                        mvn -pl notification-service spring-boot:run
# frontend — terminal #3
cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:8080/api/v2 npm run dev
```

Kafka and the notification-service are optional for basic dev — without a broker the indexer
simply skips event publishing (failures are swallowed).

## Testing

```bash
cd ethereum && npx hardhat test          # 141 passing  (npx hardhat coverage for coverage)
cd sui      && sui move test              # 22 passing   (--coverage for coverage)
cd backend  && mvn test                   # 101 passing  (JaCoCo report in target/site/jacoco)
cd frontend && npx vitest run             # 113 passing  (--coverage for coverage)
```

Static analysis: `cd ethereum && slither .` (0 High / 0 Medium).

## Environment variables

### Indexer service

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL connection | `localhost` / `5432` / `multichain_dex` / `dex` / `dex_password` |
| `SEPOLIA_RPC_URL` / `POLYGON_RPC_URL` / `SUI_RPC_URL` | Server-side RPC endpoints (never exposed to the browser) | public demo endpoints (rate-limited) |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka brokers | `localhost:9092` |
| `INDEXER_ENABLED` / `INDEXER_INTERVAL` | Toggle / poll interval (ms) | `true` / `10000` |
| `CORS_ORIGINS` | Allowed frontend origin | `http://localhost:3000` |

### Notification service

| Variable | Description | Default |
|----------|-------------|---------|
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka brokers | `localhost:9092` |
| `MAIL_HOST` / `MAIL_PORT` | SMTP server (Mailpit in dev) | `localhost` / `1025` |
| `NOTIFICATIONS_TOPIC` | Kafka topic | `dex.orders` |

### Frontend (baked into the build)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend REST API URL | Yes |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` / `NEXT_PUBLIC_POLYGON_AMOY_RPC_URL` | RPC for balance/allowance reads only | No (public fallback) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID | No |

See [.env.example](.env.example) for the full template.

## REST API (prefix `/api/v2`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chains`, `/tokens` | Chain & token registry |
| GET | `/orders`, `/orders/my` | Order book (filterable) / a wallet's orders |
| GET | `/swaps/active`, `/swaps/history` | Active swaps (+ HTLC details) / history |
| POST | `/orders/metadata` | Attach off-chain metadata (full target address, opt-in email) |
| POST | `/tx/notify` | Hint the indexer about a new transaction for fast indexing |
| GET | `/health` | Liveness |

## Frontend pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — hero, stats, CTAs |
| `/orders` | Unified order book — browse, create and match orders (chain-pair filtering) |
| `/profile` | Profile — overview, connected wallets, swap history, settings (incl. notification email) |

## Deployed contracts (testnet)

### Ethereum Sepolia (chainId 11155111)

| Contract | Address |
|----------|---------|
| HTLC | `0x9aB954f470cc7196C0803bE44b1d58e762a48964` |
| CrossChainOrderBook | `0x6A78740f7D35818D30e23ebD5A5880A1836aa445` |
| OrderBook | `0x96c763c1Cb33e5be34c20980570Fe1614F3df05e` |
| Trade | `0x125B8201BFB93337b298Dc650F9729a2aa7E2061` |

### Polygon Amoy (chainId 80002)

| Contract | Address |
|----------|---------|
| HTLC | `0x3d857Fc3510246A050817C29ea7C434ab7EbA81A` |
| CrossChainOrderBook | `0x5F08Ec67A95C4394d577c90c65083AEb119BD922` |
| OrderBook | `0x22763589e1dd35d1FE86c51B0593E71677d72054` |
| Trade | `0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5` |

### SUI testnet

| Module | Object/Package |
|--------|----------------|
| htlc package | `0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96` |
| cross_chain_order_book / order_book | `0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0` |

## License

MIT
