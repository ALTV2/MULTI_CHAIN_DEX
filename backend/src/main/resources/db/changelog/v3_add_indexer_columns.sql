--liquibase formatted sql

--changeset multichain:7-add-indexer-tracking-columns
ALTER TABLE chains ADD COLUMN IF NOT EXISTS last_indexed_order_id BIGINT DEFAULT 0;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS last_withdrawn_cursor VARCHAR(500);
