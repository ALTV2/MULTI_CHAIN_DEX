-- liquibase formatted sql

-- changeset dev:9
CREATE TABLE IF NOT EXISTS cross_chain_addresses (
    evm_address  VARCHAR(200) PRIMARY KEY,
    sui_address  VARCHAR(200) NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
