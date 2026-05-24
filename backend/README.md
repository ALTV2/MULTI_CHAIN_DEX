# Multi-Chain DEX — Backend

Spring Boot multi-module backend that indexes EVM and SUI blockchains into
PostgreSQL and serves a public REST API for the frontend. No authentication
layer — all data is public on-chain data.

For the full design rationale (DB schema, indexer flow, principles) see
[ARCHITECTURE.md](ARCHITECTURE.md).

## Modules

| Module | Port | Purpose |
| --- | --- | --- |
| [`indexer-service`](indexer-service/) | 8080 | Polls EVM (Web3j) + SUI (HTTP JSON-RPC) and exposes `/api/v2/*` REST API. Publishes `OrderPhaseEvent` to Kafka on phase transitions. |
| [`notification-service`](notification-service/) | — | Kafka consumer that renders Thymeleaf email templates and delivers them via SMTP (mailpit in dev). MANUAL ack mode + DLT retry. |

## Tech stack

- Java 21
- Spring Boot 3.3 (Web, Data JPA, Kafka, Mail)
- PostgreSQL 16 + Liquibase migrations (`indexer-service/src/main/resources/db/changelog/`)
- Apache Kafka (event bus between indexer and notification)
- Web3j 4.12 (EVM JSON-RPC)
- Thymeleaf (email templates)
- Lombok (boilerplate)
- SpringDoc OpenAPI (Swagger UI at `/swagger-ui.html` when the indexer is running)

## Quick start (Docker Compose)

The full stack — Postgres, Kafka, indexer, notification, mailpit — is
orchestrated from the project root:

```bash
# from project root
docker compose up -d
```

This brings up:

- `db` (PostgreSQL) on `5432`
- `kafka` on `9092`
- `mailpit` on `1025` (SMTP) + `8025` (web UI)
- `indexer` on `8080`
- `notification` (no exposed port)

Healthcheck: `curl http://localhost:8080/api/v2/chains` should return the
chain registry.

## Build

Backend uses Maven multi-module reactor:

```bash
# Compile + package both modules (skips tests)
mvn -f backend/pom.xml clean package -DskipTests

# Build a single module + its dependencies
mvn -f backend/pom.xml clean package -DskipTests -pl indexer-service -am
```

JDK 21 is required. If your shell uses a newer JDK, point Maven at 21:

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn ...
```

Built JARs land at:

- `backend/indexer-service/target/dex-indexer-service-2.0.0.jar`
- `backend/notification-service/target/dex-notification-service-2.0.0.jar`

## Test

```bash
# Run all backend tests
mvn -f backend/pom.xml test

# Only one module
mvn -f backend/pom.xml test -pl indexer-service
```

Tests use H2 in-memory + embedded Kafka. No external services required.

## Run locally (without Docker)

You need Postgres and Kafka running locally first. Then:

```bash
# Indexer service
java -jar backend/indexer-service/target/dex-indexer-service-2.0.0.jar

# Notification service
java -jar backend/notification-service/target/dex-notification-service-2.0.0.jar
```

Environment variables to set (see `application.yml` in each module for full
defaults):

| Variable | Used by | Default |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | indexer | `jdbc:postgresql://localhost:5432/multichain_dex` |
| `SPRING_DATASOURCE_USERNAME` | indexer | `dex` |
| `SPRING_DATASOURCE_PASSWORD` | indexer | `dex_password` |
| `KAFKA_BOOTSTRAP_SERVERS` | both | `localhost:9092` |
| `SEPOLIA_RPC_URL` | indexer | (required) |
| `POLYGON_RPC_URL` | indexer | (required) |
| `SUI_RPC_URL` | indexer | (required) |
| `MAIL_HOST` / `MAIL_PORT` | notification | `localhost` / `1025` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | notification | (empty for mailpit) |
| `NOTIFICATIONS_FROM` | notification | `noreply@multichain-dex.local` |
| `INDEXER_POLLING_INTERVAL` | indexer | `10000` (ms) |
| `CORS_ORIGINS` | indexer | `http://localhost:3000` |

## REST API

Public endpoints are mounted at `/api/v2/`:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/chains` | Supported chain registry |
| GET | `/tokens?chainId=` | Token registry per chain |
| GET | `/orders?status=&sourceChain=&targetChain=` | Order book (paginated) |
| GET | `/orders/my?wallet=` | Orders created or matched by these wallets |
| POST | `/orders/metadata` | Attach off-chain metadata (email, full target address) |
| GET | `/swaps/active?wallet=` | Active swaps with HTLC details |
| GET | `/swaps/history?wallet=` | Completed / refunded swaps |
| POST | `/tx/notify` | Frontend hint to force-index a fresh transaction |

Interactive docs (Swagger UI) live at `http://localhost:8080/swagger-ui.html`
once the indexer is running.

## Database migrations

Schema is managed by Liquibase, files under
`indexer-service/src/main/resources/db/changelog/`. The master changelog
includes versioned SQL files (`v1_...`, `v2_...`, …). Adding a migration:

1. Create `vN_short_description.sql` with `-- liquibase formatted sql` header
2. Add an `<include>` entry in `db.changelog-master.yaml`
3. Restart indexer — Liquibase runs migrations on application start

## Notification service notes

- Consumer group: `notification-service`
- Topic: `dex.orders` (configurable via `NOTIFICATIONS_TOPIC`)
- Failed records that exhaust retries land in `dex.orders.DLT`
- Email delivery is best-effort per recipient: bad addresses are logged,
  transport-level SMTP failures are rethrown so Kafka can retry

## Common gotchas

- Lombok 1.18.36 has compatibility issues with JDK 25 (Homebrew default on
  some systems). Force JDK 21 via `JAVA_HOME=$(/usr/libexec/java_home -v 21)`
  if you hit `TypeTag :: UNKNOWN` at compile time.
- The indexer reads `rpc_url` from the `chains` DB table on every cycle —
  changing it via SQL takes effect on the next poll without restart.
- Alchemy free-tier rate limits (HTTP 429) are absorbed by exponential
  backoff with jitter (5 retries, 1s base, 10s cap). Persistent 429s are
  logged at DEBUG level.
