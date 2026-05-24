--liquibase formatted sql

--changeset multichain:11-separate-sc-order-counter
ALTER TABLE chains ADD COLUMN IF NOT EXISTS last_indexed_sc_order_id BIGINT DEFAULT 0;
