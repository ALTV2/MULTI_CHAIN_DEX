--liquibase formatted sql

--changeset multichain:9-add-sui-same-chain-meta
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sui_same_chain_meta JSONB;
