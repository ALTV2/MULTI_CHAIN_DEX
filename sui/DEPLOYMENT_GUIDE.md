# SUI Testnet Deployment Guide

Complete guide for deploying Multi-Chain DEX contracts to SUI testnet.

## Prerequisites

### 1. Install SUI CLI

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

Verify installation:
```bash
sui --version
# Should output: sui 1.x.x-...
```

### 2. Create SUI Wallet

```bash
# Create new address
sui client new-address ed25519
```

**IMPORTANT:** Save the mnemonic phrase that appears! You'll need it for deployment.

Example output:
```
Created new keypair and saved it to keystore.
- address: 0x1234567890abcdef...
- mnemonic: word1 word2 word3 ... word12
```

### 3. Fund Your Wallet

Get testnet SUI from the faucet:

**Option A: Web Faucet**
1. Visit: https://faucet.sui.io/
2. Select "Testnet"
3. Enter your address
4. Click "Request SUI"

**Option B: CLI Faucet**
```bash
sui client faucet --address <YOUR_ADDRESS>
```

Check balance:
```bash
sui client gas
```

You should see ~1 SUI (1,000,000,000 MIST).

---

## Setup

### 1. Install Dependencies

```bash
cd sui
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your mnemonic:
```env
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_MNEMONIC="your twelve word mnemonic phrase here"
```

**Security Note:** Never commit `.env` file! It's in `.gitignore`.

---

## Build & Test

### Build Contracts

```bash
npm run build
# or
sui move build
```

Expected output:
```
BUILDING multi_chain_dex
...
Build Successful
```

### Run Tests

```bash
npm run test
# or
sui move test
```

Expected output:
```
Running Move unit tests
[ PASS    ] dex::htlc_tests::test_create_swap
[ PASS    ] dex::htlc_tests::test_withdraw_with_secret
[ PASS    ] dex::htlc_tests::test_refund_after_timelock
...
Test result: OK. Total tests: 9; passed: 9; failed: 0
```

---

## Deployment

### Step 1: Deploy Contracts

```bash
npm run deploy
```

This will:
1. Build the Move package
2. Publish contracts to SUI testnet
3. Initialize CrossChainOrderBook
4. Add supported chains (Ethereum Sepolia, Polygon Amoy)
5. Save deployment info to `deployment-info.json`

**Expected output:**
```
🚀 Deploying Multi-Chain DEX contracts to SUI testnet...

📦 Building Move package...
...

👤 Deployer: 0x1234...
💰 Balance: 0.9876 SUI

📝 Publishing 7 modules...
⏳ Waiting for transaction confirmation...
✅ Transaction successful: ABC123...

📦 Package ID: 0xabcdef...

🔗 Adding supported chains...
  ✅ Added Ethereum Sepolia (11155111)
  ✅ Added Polygon Amoy (80002)

============================================================
🎉 DEPLOYMENT SUMMARY
============================================================
Network:          SUI Testnet
Package ID:       0xabcdef1234567890...
OrderBook ID:     0x9876543210fedcba...
Deployer:         0x1234567890abcdef...
Explorer:         https://suiexplorer.com/object/0xabcdef...?network=testnet
============================================================
```

**Save this information!** You'll need the Package ID for frontend integration.

### Step 2: Mint Test Tokens

```bash
npm run init-tokens
```

This will mint 1000 sTKA and 1000 sTKB to your address.

**Expected output:**
```
🪙 Minting test tokens...

👤 Address: 0x1234...
📦 Package: 0xabcdef...

🔍 Finding TreasuryCap objects...
  ✅ TKA TreasuryCap: 0x111...
  ✅ TKB TreasuryCap: 0x222...

💰 Minting 1000 tokens to 0x1234...

1. Minting sTKA...
   ✅ Transaction: XYZ123...

2. Minting sTKB...
   ✅ Transaction: XYZ456...

✨ Checking balances...
  sTKA: 1000
  sTKB: 1000

============================================================
🎉 TOKENS MINTED SUCCESSFULLY
============================================================
Coin Types (for frontend):
  sTKA: 0xabcdef...::test_token_a::TEST_TOKEN_A
  sTKB: 0xabcdef...::test_token_b::TEST_TOKEN_B
============================================================
```

### Step 3: Verify Deployment

```bash
npm run verify
```

This checks that all contracts are deployed correctly.

**Expected output:**
```
🔍 Verifying SUI deployment...

📦 Checking package...
  ✅ Package exists
     0xabcdef...

📖 Checking OrderBook...
  ✅ OrderBook exists
     0x9876...
     Type: 0xabcdef...::cross_chain_order_book::OrderBook

🪙 Checking token modules...
  ✅ sTKA token deployed
     0xabcdef...::test_token_a::TEST_TOKEN_A
  ✅ sTKB token deployed
     0xabcdef...::test_token_b::TEST_TOKEN_B

💰 Checking deployer balances...
  SUI: 0.8765
  sTKA: 1000
  sTKB: 1000

============================================================
📊 VERIFICATION SUMMARY
============================================================
Network:  SUI Testnet
Package:  0xabcdef...
Deployer: 0x1234...

Explorer Links:
  Package: https://suiexplorer.com/object/0xabcdef...?network=testnet
  OrderBook: https://suiexplorer.com/object/0x9876...?network=testnet
============================================================
```

---

## Post-Deployment

### Update Frontend Configuration

After successful deployment, update the frontend with your contract addresses:

**File:** `frontend/lib/contracts/addresses.ts`

```typescript
export const contractAddresses = {
  // ... existing EVM chains

  'sui:testnet': {
    htlc: '<YOUR_PACKAGE_ID>',
    crossChainOrderBook: '<YOUR_ORDERBOOK_OBJECT_ID>',
    orderBook: '<YOUR_PACKAGE_ID>', // Same as htlc
    testTokenA: '<YOUR_PACKAGE_ID>::test_token_a::TEST_TOKEN_A',
    testTokenB: '<YOUR_PACKAGE_ID>::test_token_b::TEST_TOKEN_B',
  },
};
```

Get these values from `deployment-info.json`:
```bash
cat deployment-info.json
```

---

## Manual Testing

### Test HTLC Swap

1. **Generate secret and hashlock:**

```bash
# In Node.js console
const crypto = require('crypto');
const secret = '0x' + crypto.randomBytes(32).toString('hex');
const hashlock = '0x' + crypto.createHash('sha3-256').update(Buffer.from(secret.slice(2), 'hex')).digest('hex');
console.log('Secret:', secret);
console.log('Hashlock:', hashlock);
```

2. **Create swap:**

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module htlc \
  --function create_swap \
  --type-args '0x2::sui::SUI' \
  --args <swap_id> <participant_address> <hashlock> <timelock> <coin_object_id> 0x6 \
  --gas-budget 10000000
```

3. **Withdraw with secret:**

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module htlc \
  --function withdraw \
  --type-args '0x2::sui::SUI' \
  --args <swap_object_id> <secret> 0x6 \
  --gas-budget 10000000
```

### Test Cross-Chain Order

1. **Create order:**

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module cross_chain_order_book \
  --function create_order \
  --args <orderbook_id> <sell_token> <sell_amount> <buy_token> <buy_amount> <target_chain_id> <target_address> <min_timelock> <expires_at> 0x6 \
  --gas-budget 10000000
```

---

## Troubleshooting

### "Insufficient gas"

Get more testnet SUI:
```bash
sui client faucet
```

### "Module not found"

Rebuild the package:
```bash
sui move build --force
```

### "Address mismatch"

Make sure your `.env` mnemonic matches:
```bash
# Check your active address
sui client active-address

# Export address from mnemonic
sui keytool export --address <ADDRESS>
```

### Build fails

Clean and rebuild:
```bash
rm -rf build/
sui move build
```

### Transaction fails

Check gas budget and increase if needed:
```bash
--gas-budget 20000000  # 0.02 SUI
```

---

## Cost Estimates

Typical gas costs on SUI testnet:

| Operation | Estimated Cost |
|-----------|----------------|
| Package Publish | ~0.05 SUI |
| Create HTLC Swap | ~0.005 SUI |
| Withdraw HTLC | ~0.003 SUI |
| Create Order | ~0.004 SUI |
| Match Order | ~0.003 SUI |
| Mint Tokens | ~0.002 SUI |

**Total for full deployment + testing:** ~0.1-0.2 SUI

---

## Explorer Links

**Testnet Explorer:** https://suiexplorer.com/?network=testnet

View your deployment:
- Package: `https://suiexplorer.com/object/<PACKAGE_ID>?network=testnet`
- Transactions: `https://suiexplorer.com/txblock/<TX_DIGEST>?network=testnet`
- Address: `https://suiexplorer.com/address/<YOUR_ADDRESS>?network=testnet`

---

## Next Steps

After successful deployment:

1. ✅ Save `deployment-info.json` (contains all addresses)
2. ✅ Update frontend configuration
3. ✅ Test contracts manually via CLI
4. ✅ Integrate with frontend UI
5. ✅ Test cross-chain swaps (SUI ↔ Sepolia)

---

## Support

- **SUI Documentation:** https://docs.sui.io/
- **SUI Discord:** https://discord.gg/sui
- **SUI Faucet:** https://faucet.sui.io/
- **Explorer:** https://suiexplorer.com/

For project-specific issues, refer to the main README or open a GitHub issue.
