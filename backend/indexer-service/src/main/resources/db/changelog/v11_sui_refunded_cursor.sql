-- liquibase formatted sql

-- changeset dev:11
-- Add a third event cursor for SUI SwapRefunded event indexing so the indexer
-- can populate refund_tx_hash and detect REFUNDED status reactively (instead of
-- only via slow status polling).

ALTER TABLE chains ADD COLUMN last_refunded_cursor VARCHAR(500);
