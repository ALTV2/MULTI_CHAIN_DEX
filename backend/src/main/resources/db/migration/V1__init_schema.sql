-- MultiChain DEX Database Schema
-- Version: 1.0

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_wallet_address VARCHAR(42) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_wallet ON users(primary_wallet_address);
CREATE INDEX idx_users_email ON users(email);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    label VARCHAR(50),
    encrypted_private_key TEXT,
    imported BOOLEAN NOT NULL DEFAULT false,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, address, chain)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(address);

-- Auth nonces table (for Web3 authentication)
CREATE TABLE auth_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    nonce VARCHAR(255) NOT NULL UNIQUE,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_nonces_wallet ON auth_nonces(wallet_address);
CREATE INDEX idx_nonces_expires ON auth_nonces(expires_at);

-- Swap history table
CREATE TABLE swap_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    htlc_swap_id VARCHAR(66),
    cross_chain_order_id VARCHAR(66),
    source_chain VARCHAR(50) NOT NULL,
    target_chain VARCHAR(50) NOT NULL,
    source_token VARCHAR(42),
    source_amount NUMERIC(36, 18),
    target_token VARCHAR(42),
    target_amount NUMERIC(36, 18),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    source_tx_hash VARCHAR(66),
    target_tx_hash VARCHAR(66),
    hashlock VARCHAR(66),
    timelock_expiry TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_swap_user ON swap_history(user_id);
CREATE INDEX idx_swap_status ON swap_history(status);
CREATE INDEX idx_swap_htlc_id ON swap_history(htlc_swap_id);
CREATE INDEX idx_swap_created ON swap_history(created_at);
