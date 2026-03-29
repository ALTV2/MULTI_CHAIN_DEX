--liquibase formatted sql

--changeset multichain:5-seed-chains
INSERT INTO chains (id, name, short_name, chain_type, rpc_url, block_explorer, native_symbol, native_decimals, contracts) VALUES
('11155111', 'Ethereum (Sepolia)', 'Ethereum', 'EVM',
 'https://eth-sepolia.g.alchemy.com/v2/demo',
 'https://sepolia.etherscan.io', 'ETH', 18,
 '{"orderBook":"0x96c763c1Cb33e5be34c20980570Fe1614F3df05e","htlc":"0x9aB954f470cc7196C0803bE44b1d58e762a48964","ccob":"0x6A78740f7D35818D30e23ebD5A5880A1836aa445","trade":"0x125B8201BFB93337b298Dc650F9729a2aa7E2061"}'),

('80002', 'Polygon (Amoy)', 'Polygon', 'EVM',
 'https://polygon-amoy.g.alchemy.com/v2/demo',
 'https://amoy.polygonscan.com', 'MATIC', 18,
 '{"orderBook":"0x22763589e1dd35d1FE86c51B0593E71677d72054","htlc":"0x3d857Fc3510246A050817C29ea7C434ab7EbA81A","ccob":"0x5F08Ec67A95C4394d577c90c65083AEb119BD922","trade":"0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5"}'),

('sui:testnet', 'SUI (Testnet)', 'SUI', 'SUI',
 'https://fullnode.testnet.sui.io',
 'https://suiexplorer.com/?network=testnet', 'SUI', 9,
 '{"htlc":"0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96","ccob":"0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0","orderBook":"0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0"}')
ON CONFLICT (id) DO NOTHING;

--changeset multichain:6-seed-tokens
-- Ethereum Sepolia tokens
INSERT INTO tokens (chain_id, address, symbol, name, decimals, is_native) VALUES
('11155111', '0x0000000000000000000000000000000000000000', 'ETH', 'Sepolia ETH', 18, true),
('11155111', '0x16eb4f1a13dC130074360a14ec5ee01632e87584', 'TKA', 'Test Token A', 18, false),
('11155111', '0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644', 'TKB', 'Test Token B', 18, false)
ON CONFLICT (chain_id, address) DO NOTHING;

-- Polygon Amoy tokens
INSERT INTO tokens (chain_id, address, symbol, name, decimals, is_native) VALUES
('80002', '0x0000000000000000000000000000000000000000', 'MATIC', 'MATIC', 18, true),
('80002', '0x711F11CfeD1D00f981BdA0E7B892dDa6f2EA47c5', 'pTKA', 'Polygon Test Token A', 18, false),
('80002', '0xCADe258E49B605cEaCe568A688893589D8E72907', 'pTKB', 'Polygon Test Token B', 18, false)
ON CONFLICT (chain_id, address) DO NOTHING;

-- SUI Testnet tokens
INSERT INTO tokens (chain_id, address, symbol, name, decimals, is_native) VALUES
('sui:testnet', '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI', 'SUI', 'SUI', 9, true),
('sui:testnet', '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_a::TEST_TOKEN_A', 'sTKA', 'SUI Test Token A', 9, false),
('sui:testnet', '0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96::test_token_b::TEST_TOKEN_B', 'sTKB', 'SUI Test Token B', 9, false)
ON CONFLICT (chain_id, address) DO NOTHING;
