# Multi-Chain DEX Backend — Architecture PRD

## Overview

Backend serves as a **blockchain indexer + REST API**. It periodically polls EVM and SUI blockchains, stores order/HTLC data in PostgreSQL, and exposes a clean REST API for the frontend. No authentication, no user management — all data is public blockchain data.

**Stack**: Java 21, Spring Boot 3.3, PostgreSQL, Flyway, Web3j (EVM), HTTP client (SUI JSON-RPC)

---

## Principles

1. **Backend = source of truth for UI**. Frontend reads ONLY from backend API, never from blockchain directly.
2. **Blockchain = source of truth for backend**. Backend polls chains and upserts data into DB.
3. **Secret stays in browser**. User generates secret locally; backend only sees it after on-chain reveal (SwapWithdrawn event).
4. **Transactions signed in wallet**. wagmi/SUI dapp-kit remain on frontend for write operations (createOrder, createHTLC, withdraw, etc.).
5. **No authentication**. All endpoints are public — blockchain data is public.
6. **Minimal RPC calls**. Indexer is optimized to use as few Alchemy API calls as possible per cycle.
7. **Terminal orders are frozen**. Orders in COMPLETED/CANCELLED/REFUNDED status are never re-polled.

---

## Database Schema

### Table: `chains`
Registry of supported blockchains. Drives indexer polling and frontend chain selector.

```sql
CREATE TABLE chains (
    id                  VARCHAR(50)  PRIMARY KEY,   -- "11155111", "80002", "sui:testnet"
    name                VARCHAR(100) NOT NULL,       -- "Ethereum (Sepolia)"
    short_name          VARCHAR(30)  NOT NULL,       -- "Ethereum"
    chain_type          VARCHAR(10)  NOT NULL,       -- "EVM" | "SUI"
    rpc_url             VARCHAR(500) NOT NULL,       -- Alchemy URL (server-side only, never exposed)
    block_explorer      VARCHAR(500),                -- "https://sepolia.etherscan.io"
    native_symbol       VARCHAR(10)  NOT NULL,       -- "ETH", "MATIC", "SUI"
    native_decimals     INT          NOT NULL,       -- 18, 18, 9
    contracts           JSONB        NOT NULL,       -- {"orderBook":"0x...","htlc":"0x...","ccob":"0x..."}
    polling_enabled     BOOLEAN      NOT NULL DEFAULT true,
    last_indexed_block  BIGINT       DEFAULT 0,      -- EVM: last processed block number
    last_event_cursor   VARCHAR(500),                -- SUI: last processed event cursor
    last_polled_at      TIMESTAMP,
    created_at          TIMESTAMP    NOT NULL DEFAULT now()
);
```

### Table: `tokens`
Registry of tradeable tokens across all chains.

```sql
CREATE TABLE tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id    VARCHAR(50)  NOT NULL REFERENCES chains(id),
    address     VARCHAR(200) NOT NULL,  -- "0x16eb..." (EVM) or "0x0e1c...::module::TYPE" (SUI)
    symbol      VARCHAR(20)  NOT NULL,  -- "TKA", "sTKA", "ETH"
    name        VARCHAR(100),           -- "Test Token A"
    decimals    INT          NOT NULL,  -- 18, 9
    is_native   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    UNIQUE(chain_id, address)
);

CREATE INDEX idx_tokens_chain ON tokens(chain_id);
```

### Table: `orders`
All orders from all chains and order types (same-chain + cross-chain, EVM + SUI).

```sql
CREATE TABLE orders (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_chain_id     VARCHAR(50)  NOT NULL REFERENCES chains(id),
    on_chain_order_id   VARCHAR(100) NOT NULL,  -- "5" (EVM), "3" (SUI)
    order_type          VARCHAR(20)  NOT NULL,  -- "SAME_CHAIN" | "CROSS_CHAIN"

    creator             VARCHAR(200) NOT NULL,  -- creator address (EVM 0x... or SUI 0x...)
    matcher             VARCHAR(200),           -- matcher address (null if not matched)

    sell_token_id       UUID         NOT NULL REFERENCES tokens(id),
    sell_amount         NUMERIC(78,0) NOT NULL, -- raw amount in token's native decimals
    buy_token_id        UUID         NOT NULL REFERENCES tokens(id),
    buy_amount          NUMERIC(78,0) NOT NULL,

    target_chain_id     VARCHAR(50)  REFERENCES chains(id),  -- null for same-chain
    target_address      VARCHAR(200),           -- receiving address on target chain

    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|MATCHED|COMPLETED|CANCELLED|EXPIRED
    phase               VARCHAR(30)  NOT NULL DEFAULT 'ORDER_CREATED',
    -- Phases: ORDER_CREATED, ORDER_MATCHED, CREATOR_HTLC_CREATED,
    --         MATCHER_HTLC_CREATED, SECRET_REVEALED, COMPLETED, REFUNDABLE, REFUNDED

    execution_tx_hash   VARCHAR(100),           -- same-chain: direct execution tx hash
    expires_at          TIMESTAMP,

    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now(),
    matched_at          TIMESTAMP,
    completed_at        TIMESTAMP,

    UNIQUE(source_chain_id, on_chain_order_id)
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_phase ON orders(phase);
CREATE INDEX idx_orders_creator ON orders(creator);
CREATE INDEX idx_orders_matcher ON orders(matcher);
CREATE INDEX idx_orders_source_chain ON orders(source_chain_id);
CREATE INDEX idx_orders_target_chain ON orders(target_chain_id);
CREATE INDEX idx_orders_sell_token ON orders(sell_token_id);
CREATE INDEX idx_orders_buy_token ON orders(buy_token_id);
```

### Table: `htlc_swaps`
HTLC contracts created for cross-chain order execution. Each cross-chain order has up to 2 HTLCs (creator + matcher).

```sql
CREATE TABLE htlc_swaps (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID         NOT NULL REFERENCES orders(id),
    role                VARCHAR(10)  NOT NULL,  -- "CREATOR" | "MATCHER"

    chain_id            VARCHAR(50)  NOT NULL REFERENCES chains(id),
    on_chain_swap_id    VARCHAR(66),            -- bytes32 hex (EVM swap ID)
    sui_object_id       VARCHAR(66),            -- SUI HTLC object ID (null for EVM)

    initiator           VARCHAR(200) NOT NULL,  -- who locked tokens
    participant         VARCHAR(200) NOT NULL,  -- who can withdraw

    token_id            UUID         REFERENCES tokens(id),
    amount              NUMERIC(78,0),
    hashlock            VARCHAR(66),            -- bytes32 hex
    timelock            TIMESTAMP,

    status              VARCHAR(15)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|WITHDRAWN|REFUNDED
    secret              VARCHAR(66),            -- revealed on-chain secret (from SwapWithdrawn event)

    creation_tx_hash    VARCHAR(100),
    withdraw_tx_hash    VARCHAR(100),
    refund_tx_hash      VARCHAR(100),

    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now(),

    UNIQUE(order_id, role)
);

CREATE INDEX idx_htlc_order ON htlc_swaps(order_id);
CREATE INDEX idx_htlc_status ON htlc_swaps(status);
CREATE INDEX idx_htlc_chain ON htlc_swaps(chain_id);
CREATE INDEX idx_htlc_hashlock ON htlc_swaps(hashlock);
CREATE INDEX idx_htlc_on_chain_id ON htlc_swaps(on_chain_swap_id);
CREATE INDEX idx_htlc_sui_object ON htlc_swaps(sui_object_id);
```

---

## REST API

All endpoints are **public, no authentication**.

### Reference Data

```
GET /api/v2/chains
    Response: [{ id, name, shortName, chainType, nativeSymbol, nativeDecimals, blockExplorer, contracts }]

GET /api/v2/tokens?chainId={chainId}
    Response: [{ id, chainId, address, symbol, name, decimals, isNative }]
```

### Order Book

```
GET /api/v2/orders
    Query params (all optional):
        status        = ACTIVE (default) | MATCHED | COMPLETED | CANCELLED | EXPIRED
        sourceChain   = chain id (e.g., "11155111")
        targetChain   = chain id
        orderType     = SAME_CHAIN | CROSS_CHAIN
        sellToken     = token symbol or address
        buyToken      = token symbol or address
        page          = 0 (default)
        size          = 50 (default, max 200)
    Response: Page<OrderResponse>

GET /api/v2/orders/my?wallet={addr}&wallet={addr}
    Query params:
        wallet        = wallet addresses (multiple allowed, required)
        status        = filter by status (optional, comma-separated)
        role          = "creator" | "matcher" (optional)
        page, size
    Logic: WHERE creator IN (:wallets) OR matcher IN (:wallets)
    Response: Page<OrderResponse>
```

### Swaps (cross-chain with HTLC details)

```
GET /api/v2/swaps/active?wallet={addr}&wallet={addr}
    Query params:
        wallet        = wallet addresses (multiple, required)
    Logic: Non-terminal orders where wallet is creator or matcher, enriched with HTLC data
    Response: [SwapResponse]

GET /api/v2/swaps/history?wallet={addr}&wallet={addr}&page=0&size=20
    Logic: Terminal orders (COMPLETED, CANCELLED, EXPIRED, REFUNDED)
    Response: Page<SwapResponse>
```

### Transaction Notification

```
POST /api/v2/tx/notify
    Body: {
        chainId:  "11155111",
        txHash:   "0xabc...",
        type:     "ORDER_CREATE" | "ORDER_MATCH" | "ORDER_CANCEL" |
                  "HTLC_CREATE" | "HTLC_WITHDRAW" | "HTLC_REFUND" |
                  "SAME_CHAIN_EXECUTE",
        orderId:  "5"           (optional, on-chain order ID if known),
        wallet:   "0x..."       (optional, sender address)
    }
    Response: 202 Accepted
    Effect: Backend immediately processes this tx instead of waiting for polling cycle
```

### Health

```
GET /api/v2/health
    Response: { status: "UP", chains: [{ id, lastPolledAt, lastIndexedBlock }] }
```

---

## Response DTOs

### OrderResponse
```json
{
    "id": "uuid",
    "sourceChainId": "11155111",
    "onChainOrderId": "5",
    "orderType": "CROSS_CHAIN",

    "creator": "0x64Ab3C77...",
    "matcher": "0x7C26774e...",

    "sellToken": { "address": "0x0000...0000", "symbol": "ETH", "decimals": 18 },
    "sellAmount": "20000000000000000",
    "formattedSellAmount": "0.02",

    "buyToken": { "address": "0x2::sui::SUI", "symbol": "SUI", "decimals": 9 },
    "buyAmount": "480000000",
    "formattedBuyAmount": "0.48",

    "targetChainId": "sui:testnet",
    "targetAddress": "0xf08a...",

    "status": "MATCHED",
    "phase": "CREATOR_HTLC_CREATED",
    "expiresAt": 1711756800,

    "createdAt": "2026-03-29T10:00:00Z",
    "matchedAt": "2026-03-29T10:05:00Z"
}
```

### SwapResponse
```json
{
    "order": { ... OrderResponse ... },
    "role": "creator",
    "phase": "MATCHER_HTLC_CREATED",

    "creatorHtlc": {
        "chainId": "11155111",
        "onChainSwapId": "0xabc...",
        "status": "ACTIVE",
        "hashlock": "0xdef...",
        "timelock": 1711843200,
        "token": { "symbol": "ETH", "decimals": 18 },
        "amount": "20000000000000000"
    },
    "matcherHtlc": {
        "chainId": "sui:testnet",
        "suiObjectId": "0x123...",
        "status": "ACTIVE",
        "hashlock": "0xdef...",
        "timelock": 1711756800,
        "token": { "symbol": "SUI", "decimals": 9 },
        "amount": "480000000"
    },

    "revealedSecret": null
}
```

---

## Java Class Structure

```
com.multichain.dex/
├── MultiChainDexApplication.java
│
├── config/
│   ├── CorsConfig.java
│   ├── IndexerConfig.java           — @ConfigurationProperties for polling settings
│   ├── Web3Config.java              — Web3j beans per EVM chain (from chains table)
│   ├── SuiClientConfig.java         — HTTP client for SUI JSON-RPC
│   └── GlobalExceptionHandler.java
│
├── domain/
│   ├── entity/
│   │   ├── Chain.java
│   │   ├── Token.java
│   │   ├── Order.java
│   │   └── HtlcSwap.java
│   └── enums/
│       ├── ChainType.java           — EVM, SUI
│       ├── OrderType.java           — SAME_CHAIN, CROSS_CHAIN
│       ├── OrderStatus.java         — ACTIVE, MATCHED, COMPLETED, CANCELLED, EXPIRED
│       ├── SwapPhase.java           — ORDER_CREATED, ORDER_MATCHED, CREATOR_HTLC_CREATED,
│       │                               MATCHER_HTLC_CREATED, SECRET_REVEALED, COMPLETED,
│       │                               REFUNDABLE, REFUNDED
│       ├── HtlcStatus.java          — ACTIVE, WITHDRAWN, REFUNDED
│       └── HtlcRole.java            — CREATOR, MATCHER
│
├── repository/
│   ├── ChainRepository.java
│   ├── TokenRepository.java
│   ├── OrderRepository.java         — custom queries for filtering/wallet lookup
│   └── HtlcSwapRepository.java
│
├── dto/
│   ├── TxNotifyRequest.java
│   ├── ChainResponse.java
│   ├── TokenResponse.java
│   ├── OrderResponse.java
│   ├── SwapResponse.java
│   └── TokenInfo.java               — embedded { address, symbol, decimals }
│
├── controller/
│   ├── HealthController.java
│   ├── ChainController.java         — GET /api/v2/chains
│   ├── TokenController.java         — GET /api/v2/tokens
│   ├── OrderController.java         — GET /api/v2/orders, /orders/my
│   ├── SwapController.java          — GET /api/v2/swaps/active, /swaps/history
│   └── TxNotifyController.java      — POST /api/v2/tx/notify
│
└── service/
    ├── OrderService.java             — query/filter orders from DB
    ├── SwapQueryService.java         — active swaps + history, enriched with HTLC data
    ├── TxNotifyService.java          — immediate tx processing
    ├── PhaseCalculator.java          — pure logic: order + htlcs → phase
    │
    └── indexer/
        ├── BlockchainIndexer.java    — @Scheduled orchestrator
        ├── ChainScanner.java         — interface
        ├── EvmChainScanner.java      — Web3j implementation
        └── SuiChainScanner.java      — HTTP JSON-RPC implementation
```

---

## Blockchain Indexer

### Polling Cycle (every N seconds, configurable)

```
BlockchainIndexer.poll():
    chains = chainRepo.findByPollingEnabled(true)
    for each chain:
        scanner = getScanner(chain.chainType)  // EVM or SUI
        scanner.scanOrders(chain)              // upsert new/changed orders
        scanner.scanHtlcs(chain)               // update ACTIVE htlc statuses
        chain.lastPolledAt = now()
        chainRepo.save(chain)

    recomputePhases()                          // only non-terminal orders
```

### EVM Scanner — per cycle (~5-8 RPC calls per chain)

```
EvmChainScanner.scanOrders(chain):
    1. getLogs(OrderCreated, fromBlock=lastIndexedBlock+1)         — 1 call
       → upsert new orders into DB

    2. getLogs(OrderMatched + OrderCancelled, from=lastIndexedBlock+1)  — 1 call
       → update order status/matcher in DB

    3. getActiveOrdersForTargetChain(targetChainId) for each target — 1-2 calls
       → reconcile with DB (catch any missed events)

    4. chain.lastIndexedBlock = latestBlock

EvmChainScanner.scanHtlcs(chain):
    1. getLogs(SwapCreated, fromBlock=lastIndexedBlock+1)          — 1 call
       → upsert new htlc_swaps, link to order by hashlock

    2. getLogs(SwapWithdrawn + SwapRefunded, from=lastIndexedBlock+1) — 1 call
       → update htlc status, store revealed secret

    3. For each ACTIVE htlc in DB on this chain:
       getSwap(swapId) → verify status hasn't changed              — N calls (only active)

    Total: ~5 + N (N = active HTLCs, usually 0-5)
```

### SUI Scanner — per cycle (~4-6 RPC calls)

```
SuiChainScanner.scanOrders(chain):
    1. getObject(orderBookId) + getDynamicFields()                 — 2 calls
       → upsert/reconcile orders in DB

    2. queryEvents(OrderMatched, cursor=lastEventCursor)           — 1 call
       → update matched orders

SuiChainScanner.scanHtlcs(chain):
    1. queryEvents(SwapCreated, cursor=lastEventCursor)            — 1 call
       → upsert new htlc_swaps

    2. queryEvents(SwapWithdrawn, cursor=lastEventCursor)          — 1 call
       → update htlc status, store secret

    3. For each ACTIVE SUI htlc in DB:
       getObject(suiObjectId) → verify status                     — N calls

    Total: ~5 + N
```

### POST /tx/notify — immediate processing (1-2 calls)

```
TxNotifyService.process(request):
    chain = chainRepo.findById(request.chainId)
    scanner = getScanner(chain.chainType)
    scanner.processTransaction(chain, request.txHash)
    // For EVM: getTransactionReceipt(txHash) → parse logs → upsert
    // For SUI: getTransactionBlock(txHash) → parse events → upsert
    recomputePhases()
```

### Phase Calculation (zero RPC calls — pure DB logic)

```java
PhaseCalculator.compute(Order order):
    if order.status == COMPLETED  → COMPLETED
    if order.status == CANCELLED  → REFUNDED

    creatorHtlc = htlcRepo.findByOrderAndRole(order, CREATOR)
    matcherHtlc = htlcRepo.findByOrderAndRole(order, MATCHER)

    cs = creatorHtlc?.status    // null | ACTIVE | WITHDRAWN | REFUNDED
    ms = matcherHtlc?.status

    if cs == WITHDRAWN && ms == WITHDRAWN     → COMPLETED
    if cs == WITHDRAWN && ms == ACTIVE        → SECRET_REVEALED
    if ms == WITHDRAWN && cs == ACTIVE        → SECRET_REVEALED
    if cs == ACTIVE && ms == ACTIVE           → MATCHER_HTLC_CREATED
    if cs == ACTIVE && ms == null             → CREATOR_HTLC_CREATED
    if ms == ACTIVE && cs == null             → ORDER_MATCHED (SUI→EVM: matcher locks first)
    if isExpired(creatorHtlc || matcherHtlc)  → REFUNDABLE
    if cs == REFUNDED || ms == REFUNDED       → REFUNDED
    if order.matcher != null                  → ORDER_MATCHED

    → ORDER_CREATED
```

---

## Configuration (application.yml)

```yaml
server:
  port: ${SERVER_PORT:8080}

spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:multichain_dex}
    username: ${DB_USER:dex}
    password: ${DB_PASSWORD:dex_password}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration

indexer:
  polling-interval: ${INDEXER_INTERVAL:10000}  # ms between polling cycles
  enabled: ${INDEXER_ENABLED:true}
  batch-size: ${INDEXER_BATCH_SIZE:100}         # max orders/htlcs per scan

cors:
  allowed-origins: ${CORS_ORIGINS:http://localhost:3000}
```

---

## What Frontend Keeps

- **wagmi** `writeContractAsync` / `useSwitchChain` — signing transactions
- **SUI dapp-kit** `useSignAndExecuteTransaction` — signing SUI transactions
- **wagmi** `useBalance` — wallet balance display (direct RPC through wallet, not Alchemy)
- **Secret generation** — `crypto.getRandomValues()` in browser, stored in localStorage
- **POST /api/v2/tx/notify** — after each signed tx, notify backend

## What Frontend Removes

- ALL `getPublicClient()` / `rpcClient.ts` usage
- ALL `client.readContract()` / `client.getLogs()` calls
- ALL `suiClient.queryEvents()` / `suiClient.getObject()` calls
- ALL `useReadContract` hooks (except balance checks through wallet)
- ALL `useTokenApproval` allowance checks via custom RPC (use wagmi built-in instead)
- `useActiveSwaps.ts` — replaced by `GET /api/v2/swaps/active`
- `useAllUserOrders.ts` — replaced by `GET /api/v2/orders/my` + `GET /api/v2/swaps/active`
- `useOrderBookForChain.ts` — replaced by `GET /api/v2/orders`
- `useCrossChainOrders.ts` (read part) — replaced by `GET /api/v2/orders`
- `useDetectCrossChainHTLC.ts` — replaced by backend indexer
- `useSwapSecretFromEvent.ts` — replaced by `revealedSecret` in SwapResponse
- `useSuiOrders.ts` / `useSuiUserOrders.ts` (read part) — replaced by API
- `useLiveOrderFeed.ts` — replaced by `GET /api/v2/orders`
- `lib/utils/swapPhase.ts` (determineSwapPhase) — replaced by backend PhaseCalculator
- `lib/utils/rpcClient.ts` — removed entirely
- `lib/constants/rpc.ts` — removed entirely

---

## Migration Strategy

### Flyway Migrations
```
V3__add_chains_tokens_orders_htlc.sql    — new schema (chains, tokens, orders, htlc_swaps)
V4__seed_chains_and_tokens.sql           — initial data (Sepolia, Polygon Amoy, SUI + tokens)
```

Existing tables (users, wallets, auth_nonces, swap_history) are left untouched — they can be dropped in a future cleanup migration.

---

## Implementation Order

1. **Schema + Entities**: Flyway migration, JPA entities, enums, repositories
2. **Indexer**: BlockchainIndexer, EvmChainScanner, SuiChainScanner, PhaseCalculator
3. **API**: Controllers, services, DTOs
4. **Frontend refactor**: Replace all RPC calls with API calls
