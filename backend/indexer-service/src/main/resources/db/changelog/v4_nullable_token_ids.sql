--liquibase formatted sql

--changeset multichain:8-nullable-token-ids
ALTER TABLE orders ALTER COLUMN sell_token_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN buy_token_id DROP NOT NULL;
