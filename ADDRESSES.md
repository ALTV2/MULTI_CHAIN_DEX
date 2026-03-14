# Multi-Chain DEX — Addresses Reference

> Auto-generated reference for all wallets, contracts, and tokens across all networks.
> For local addresses to be current, run `node scripts/generate-local-env.js` after redeploying.

---

## Wallets

### Anvil Test Wallets (local only)
All funded with 10,000 ETH / MATIC (native) + 10,000 TKA/TKB (ERC-20) on both local chains.

| # | Address | Private Key |
|---|---------|-------------|
| 0 (Deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Custom test | `0x7C26774eC3c296510f73abFB04E6e5892E372CF9` | *(import via mnemonic)* |

**Anvil mnemonic (accounts 0–9):**
```
test test test test test test test test test test test junk
```

> ⚠️  Never use these keys on mainnet — they are publicly known.

---

## LOCAL Chains (docker-compose.local.yml)

### Local Ethereum (Anvil)
- **Chain ID:** 31337
- **RPC URL:** `http://127.0.0.1:8545`
- **Block time:** 2 seconds
- **State:** persisted in Docker volume `multi_chain_dex_anvil_eth_state`

| Contract | Address |
|----------|---------|
| TokenManager | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| OrderBook | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| Trade | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| HTLC | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |
| CrossChainOrderBook | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |
| TestTokenA (TKA) | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |
| TestTokenB (TKB) | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` |

### Local Polygon (Anvil)
- **Chain ID:** 31338
- **RPC URL:** `http://127.0.0.1:8546`
- **Block time:** 2 seconds
- **State:** persisted in Docker volume `multi_chain_dex_anvil_polygon_state`

| Contract | Address |
|----------|---------|
| TokenManager | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| OrderBook | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| Trade | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| HTLC | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |
| CrossChainOrderBook | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` |
| TestTokenA (pTKA) | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |
| TestTokenB (pTKB) | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` |

---

## TESTNET Chains

### Ethereum Sepolia
- **Chain ID:** 11155111
- **RPC URL:** `https://eth-sepolia.g.alchemy.com/v2/<KEY>` (see `.env.local`)
- **Explorer:** https://sepolia.etherscan.io

| Contract | Address |
|----------|---------|
| TokenManager | `0x7cDA5b87638d483F9621E658Cd8d5873bE698eb5` |
| OrderBook | `0x96c763c1Cb33e5be34c20980570Fe1614F3df05e` |
| Trade | `0x125B8201BFB93337b298Dc650F9729a2aa7E2061` |
| HTLC | `0x9aB954f470cc7196C0803bE44b1d58e762a48964` |
| CrossChainOrderBook | `0x6A78740f7D35818D30e23ebD5A5880A1836aa445` |
| TestTokenA (TKA) | `0x16eb4f1a13dC130074360a14ec5ee01632e87584` |
| TestTokenB (TKB) | `0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644` |

### Polygon Amoy
- **Chain ID:** 80002
- **RPC URL:** `https://polygon-amoy.g.alchemy.com/v2/<KEY>` (see `.env.local`)
- **Explorer:** https://amoy.polygonscan.com

| Contract | Address |
|----------|---------|
| TokenManager | `0x3241Fc31fe186660d467DDb1c841EAA7ecaea6C1` |
| OrderBook | `0x22763589e1dd35d1FE86c51B0593E71677d72054` |
| Trade | `0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5` |
| HTLC | `0x3d857Fc3510246A050817C29ea7C434ab7EbA81A` |
| CrossChainOrderBook | `0x5F08Ec67A95C4394d577c90c65083AEb119BD922` |
| TestTokenA (TKA) | `0x711F11CfeD1D00f981BdA0E7B892dDa6f2EA47c5` |
| TestTokenB (TKB) | `0xCADe258E49B605cEaCe568A688893589D8E72907` |

### SUI Testnet
- **Network:** testnet (always, regardless of CHAIN_MODE — no arm64 local node)
- **RPC URL:** `https://sui-testnet.g.alchemy.com/v2/<KEY>` (see `.env.local`)
- **Explorer:** https://suiexplorer.com
- **Deployer:** `0x79c5a7976a238ef0062c39f5e4d563960070a22d042c84f9a529562634889ddb`

| Contract | Address |
|----------|---------|
| Package ID | `0x0e1c4290fd26aa735b593afac46f28fc69e8558937c148b9ec0d67429af7fc96` |
| OrderBook Object | `0xa58f40f49713b1a878b6f951626c1e7f56211c69c07433d360485d281ab4a4e0` |
| TestTokenA type | `<PackageID>::test_token_a::TEST_TOKEN_A` |
| TestTokenB type | `<PackageID>::test_token_b::TEST_TOKEN_B` |

---

## Quick start

```bash
# 1. Start local nodes
docker compose -f docker-compose.local.yml up -d

# 2. Deploy contracts (first time only, or after full reset)
cd ethereum && npx hardhat run scripts/deploy.js --network localEth
cd ethereum && npx hardhat run scripts/deploy-htlc.js --network localEth
cd polygon  && npx hardhat run scripts/deploy.js --network localPolygon
cd ..

# 3. Configure chains + mint test tokens
node scripts/setup-local.js

# 4. Write addresses to frontend/.env.local
node scripts/generate-local-env.js

# 5. Start frontend
cd frontend && npm run dev
```

## Reset local state

```bash
# Full reset (deletes all blockchain state)
docker compose -f docker-compose.local.yml down -v
# Then repeat Quick start steps 1–5
```
