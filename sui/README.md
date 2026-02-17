# Multi-Chain DEX - SUI Contracts

SUI blockchain implementation of HTLC atomic swaps and cross-chain order book for the Multi-Chain DEX.

## Overview

This package contains Move smart contracts for:
- **HTLC** (Hash Time-Locked Contracts) - Trustless cross-chain atomic swaps
- **CrossChainOrderBook** - Order discovery for cross-chain trades
- **OrderBook** - Same-chain trading
- **Trade** - Order execution
- **Test Tokens** - TKA and TKB for testing

## Prerequisites

### 1. Install SUI CLI

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

Verify installation:
```bash
sui --version
```

### 2. Generate Wallet

```bash
# Create new address
sui client new-address ed25519

# This will output your address and mnemonic phrase
# SAVE THE MNEMONIC PHRASE SECURELY
```

### 3. Get Testnet SUI

Visit the faucet:
```
https://faucet.sui.io/
```

Or use CLI:
```bash
sui client faucet --address <YOUR_ADDRESS>
```

Check balance:
```bash
sui client gas
```

You should see testnet SUI tokens (1 SUI = 1,000,000,000 MIST).

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
```

Edit `.env` and add your mnemonic:
```
SUI_MNEMONIC="your twelve word mnemonic phrase here"
```

## Development

### Build Contracts

```bash
npm run build
# or
sui move build
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
[ PASS    ] htlc::htlc_tests::test_create_swap
[ PASS    ] htlc::htlc_tests::test_withdraw_with_secret
[ PASS    ] htlc::htlc_tests::test_refund_after_timelock
...
```

## Deployment

### 1. Deploy to Testnet

```bash
npm run deploy
```

This will:
- Build the Move package
- Publish contracts to SUI testnet
- Initialize shared objects (OrderBook, etc.)
- Save deployment info to `deployment-info.json`

### 2. Mint Test Tokens

```bash
npm run init-tokens
```

### 3. Verify Deployment

```bash
npm run verify
```

## Contract Architecture

### HTLC (Hash Time-Locked Contract)

**Location:** `sources/htlc.move`

Generic HTLC implementation supporting any coin type:

```move
// Create swap
public entry fun create_swap<T>(
    swap_id: vector<u8>,        // 32 bytes
    participant: address,
    hashlock: vector<u8>,       // keccak256(secret)
    timelock: u64,
    payment: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
)

// Withdraw by revealing secret
public entry fun withdraw<T>(
    swap: &mut Swap<T>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
)

// Refund after timelock
public entry fun refund<T>(
    swap: &mut Swap<T>,
    clock: &Clock,
    ctx: &mut TxContext,
)
```

**Key features:**
- Uses **keccak256** for cross-chain compatibility with EVM
- Shared objects (both parties can interact)
- Emits events with revealed secret for cross-chain coordination

### CrossChainOrderBook

**Location:** `sources/cross_chain_order_book.move`

On-chain order book for discovering cross-chain swap intentions:

```move
public entry fun create_order(
    book: &mut OrderBook,
    sell_token: address,
    sell_amount: u64,
    buy_token: address,
    buy_amount: u64,
    target_chain_id: u64,
    ...
)
```

### Test Tokens

**Locations:** `sources/test_token_a.move`, `sources/test_token_b.move`

Mintable test tokens for development and testing:

```move
public entry fun mint(
    treasury: &mut TreasuryCap<TEST_TOKEN_A>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext
)
```

## Cross-Chain Compatibility

### Hashing Algorithm

All contracts use **keccak256** for hashlock generation to ensure compatibility with Ethereum and Polygon:

```move
use std::hash::keccak256;

let hashlock = keccak256(secret);
```

### Swap ID Generation

Swap IDs are generated consistently across all chains:

```
swapId = keccak256(initiator || participant || hashlock || timelock || chainId)
```

This ensures the same swap can be referenced across EVM and SUI.

## Testing

### Unit Tests

Each contract has unit tests in `tests/`:
- `htlc_tests.move` - HTLC contract tests
- `order_book_tests.move` - OrderBook tests
- `integration_tests.move` - Full swap flow tests

### Manual Testing

After deployment, test the swap flow:

1. **Create HTLC on SUI:**
```bash
sui client call \
  --package <PACKAGE_ID> \
  --module htlc \
  --function create_swap \
  --type-args '0x2::sui::SUI' \
  --args <swap_id> <participant> <hashlock> <timelock> <coin> 0x6
```

2. **Withdraw with secret:**
```bash
sui client call \
  --package <PACKAGE_ID> \
  --module htlc \
  --function withdraw \
  --type-args '0x2::sui::SUI' \
  --args <swap_object_id> <secret> 0x6
```

3. **Check events:**
```bash
sui client events --package <PACKAGE_ID>
```

## Troubleshooting

### "Insufficient gas"

Make sure you have enough testnet SUI:
```bash
sui client gas
sui client faucet
```

### "Module not found"

Rebuild the package:
```bash
sui move build --force
```

### "Address mismatch"

Make sure your `.env` mnemonic matches the address you're using:
```bash
sui keytool export --address <ADDRESS>
```

## Resources

- **SUI Documentation:** https://docs.sui.io/
- **SUI Explorer (Testnet):** https://suiexplorer.com/?network=testnet
- **SUI Faucet:** https://faucet.sui.io/
- **Move Language Book:** https://move-language.github.io/move/

## Support

For issues specific to SUI integration, please refer to the main project README or open an issue on GitHub.
