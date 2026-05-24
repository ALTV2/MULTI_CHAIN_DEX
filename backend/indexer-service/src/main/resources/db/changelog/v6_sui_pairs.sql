--liquibase formatted sql

--changeset multichain:10-add-sui-same-chain-pairs
-- Add same-chain pair object IDs to SUI chain contracts config
UPDATE chains SET contracts = contracts || '{
  "sameChainPairs": [
    {"pairId":"0xdf19c18b4fc74ee7f4d2a407cb6e3ad4758332e2d46c6be3c33796e2aa7dd797","coinAType":"0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_a::TEST_TOKEN_A","coinBType":"0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_b::TEST_TOKEN_B"},
    {"pairId":"0x8079033f69fe176c0e04f0cfc3da841c67dda803a38f7f71c3a8fb318047e876","coinAType":"0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_b::TEST_TOKEN_B","coinBType":"0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_a::TEST_TOKEN_A"}
  ]
}'::jsonb
WHERE id = 'sui:testnet';
