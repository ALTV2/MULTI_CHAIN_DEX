--liquibase formatted sql

--changeset multichain:12-order-type-unique-constraint
-- Fix: same-chain and cross-chain orders can share the same on_chain_order_id
-- on the same chain. Include order_type in the unique constraint.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_chain_id_on_chain_order_id_key;
ALTER TABLE orders ADD CONSTRAINT orders_chain_order_type_unique
    UNIQUE (source_chain_id, on_chain_order_id, order_type);
