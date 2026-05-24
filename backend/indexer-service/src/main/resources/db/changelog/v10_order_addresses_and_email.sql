-- liquibase formatted sql

-- changeset dev:10
-- Symmetric 4-endpoint address model for orders + opt-in notification emails.
-- Replaces the separate cross_chain_addresses table (EVM->SUI mapping) by storing
-- the full target-side address directly on the order.

ALTER TABLE orders RENAME COLUMN creator TO creator_source_address;
ALTER TABLE orders RENAME COLUMN matcher TO matcher_source_address;
ALTER TABLE orders RENAME COLUMN target_address TO creator_target_address;

ALTER TABLE orders ADD COLUMN matcher_target_address VARCHAR(200);
ALTER TABLE orders ADD COLUMN creator_email          VARCHAR(255);
ALTER TABLE orders ADD COLUMN matcher_email          VARCHAR(255);

ALTER INDEX idx_orders_creator RENAME TO idx_orders_creator_source;
ALTER INDEX idx_orders_matcher RENAME TO idx_orders_matcher_source;

DROP TABLE IF EXISTS cross_chain_addresses;
