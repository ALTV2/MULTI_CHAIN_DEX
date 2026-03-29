--liquibase formatted sql

--changeset multichain:1-create-chains
CREATE TABLE chains (
    id                  VARCHAR(50)   PRIMARY KEY,
    name                VARCHAR(100)  NOT NULL,
    short_name          VARCHAR(30)   NOT NULL,
    chain_type          VARCHAR(10)   NOT NULL CHECK (chain_type IN ('EVM', 'SUI')),
    rpc_url             VARCHAR(500)  NOT NULL,
    block_explorer      VARCHAR(500),
    native_symbol       VARCHAR(10)   NOT NULL,
    native_decimals     INT           NOT NULL,
    contracts           JSONB         NOT NULL DEFAULT '{}',
    polling_enabled     BOOLEAN       NOT NULL DEFAULT true,
    last_indexed_block  BIGINT        DEFAULT 0,
    last_event_cursor   VARCHAR(500),
    last_polled_at      TIMESTAMP,
    created_at          TIMESTAMP     NOT NULL DEFAULT now()
);

--changeset multichain:2-create-tokens
CREATE TABLE tokens (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id    VARCHAR(50)   NOT NULL REFERENCES chains(id),
    address     VARCHAR(200)  NOT NULL,
    symbol      VARCHAR(20)   NOT NULL,
    name        VARCHAR(100),
    decimals    INT           NOT NULL,
    is_native   BOOLEAN       NOT NULL DEFAULT false,
    created_at  TIMESTAMP     NOT NULL DEFAULT now(),
    UNIQUE(chain_id, address)
);
CREATE INDEX idx_tokens_chain ON tokens(chain_id);
CREATE INDEX idx_tokens_symbol ON tokens(symbol);

--changeset multichain:3-create-orders
CREATE TABLE orders (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    source_chain_id     VARCHAR(50)   NOT NULL REFERENCES chains(id),
    on_chain_order_id   VARCHAR(100)  NOT NULL,
    order_type          VARCHAR(20)   NOT NULL CHECK (order_type IN ('SAME_CHAIN', 'CROSS_CHAIN')),

    creator             VARCHAR(200)  NOT NULL,
    matcher             VARCHAR(200),

    sell_token_id       UUID          NOT NULL REFERENCES tokens(id),
    sell_amount         NUMERIC(78,0) NOT NULL,
    buy_token_id        UUID          NOT NULL REFERENCES tokens(id),
    buy_amount          NUMERIC(78,0) NOT NULL,

    target_chain_id     VARCHAR(50)   REFERENCES chains(id),
    target_address      VARCHAR(200),

    status              VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','MATCHED','COMPLETED','CANCELLED','EXPIRED')),
    phase               VARCHAR(30)   NOT NULL DEFAULT 'ORDER_CREATED'
                        CHECK (phase IN ('ORDER_CREATED','ORDER_MATCHED','CREATOR_HTLC_CREATED',
                                         'MATCHER_HTLC_CREATED','SECRET_REVEALED','COMPLETED',
                                         'REFUNDABLE','REFUNDED')),

    execution_tx_hash   VARCHAR(100),
    expires_at          TIMESTAMP,

    created_at          TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT now(),
    matched_at          TIMESTAMP,
    completed_at        TIMESTAMP,

    UNIQUE(source_chain_id, on_chain_order_id)
);

CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_orders_phase        ON orders(phase);
CREATE INDEX idx_orders_creator      ON orders(creator);
CREATE INDEX idx_orders_matcher      ON orders(matcher);
CREATE INDEX idx_orders_source_chain ON orders(source_chain_id);
CREATE INDEX idx_orders_target_chain ON orders(target_chain_id);
CREATE INDEX idx_orders_sell_token   ON orders(sell_token_id);
CREATE INDEX idx_orders_buy_token    ON orders(buy_token_id);
CREATE INDEX idx_orders_active       ON orders(status, phase) WHERE status NOT IN ('COMPLETED','CANCELLED','EXPIRED');

--changeset multichain:4-create-htlc-swaps
CREATE TABLE htlc_swaps (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    role                VARCHAR(10)   NOT NULL CHECK (role IN ('CREATOR', 'MATCHER')),

    chain_id            VARCHAR(50)   NOT NULL REFERENCES chains(id),
    on_chain_swap_id    VARCHAR(66),
    sui_object_id       VARCHAR(66),

    initiator           VARCHAR(200)  NOT NULL,
    participant         VARCHAR(200)  NOT NULL,

    token_id            UUID          REFERENCES tokens(id),
    amount              NUMERIC(78,0),
    hashlock            VARCHAR(66),
    timelock            TIMESTAMP,

    status              VARCHAR(15)   NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','WITHDRAWN','REFUNDED')),
    secret              VARCHAR(66),

    creation_tx_hash    VARCHAR(100),
    withdraw_tx_hash    VARCHAR(100),
    refund_tx_hash      VARCHAR(100),

    created_at          TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT now(),

    UNIQUE(order_id, role)
);

CREATE INDEX idx_htlc_order         ON htlc_swaps(order_id);
CREATE INDEX idx_htlc_status        ON htlc_swaps(status);
CREATE INDEX idx_htlc_chain         ON htlc_swaps(chain_id);
CREATE INDEX idx_htlc_hashlock      ON htlc_swaps(hashlock);
CREATE INDEX idx_htlc_on_chain_id   ON htlc_swaps(on_chain_swap_id);
CREATE INDEX idx_htlc_sui_object    ON htlc_swaps(sui_object_id);
CREATE INDEX idx_htlc_active        ON htlc_swaps(status) WHERE status = 'ACTIVE';
