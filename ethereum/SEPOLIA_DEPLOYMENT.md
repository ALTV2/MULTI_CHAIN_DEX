# Deployment to Sepolia Testnet

This guide will help you deploy your TestERC20 contract to the Sepolia testnet.

## Prerequisites

1. **MetaMask wallet** with some Sepolia ETH
2. **RPC Provider** (Infura or Alchemy account)
3. **Etherscan API key** (for contract verification)

---

## Step 1: Get Sepolia Test ETH

You need Sepolia ETH to pay for gas fees. Get it from these faucets:

- **Alchemy Sepolia Faucet**: https://sepoliafaucet.com/
- **Infura Sepolia Faucet**: https://www.infura.io/faucet/sepolia
- **QuickNode Faucet**: https://faucet.quicknode.com/ethereum/sepolia

You'll need at least 0.1 Sepolia ETH for deployment.

---

## Step 2: Create RPC Provider Account

### Option A: Alchemy (Recommended)

1. Go to https://alchemy.com
2. Sign up for a free account
3. Create a new app:
   - Chain: Ethereum
   - Network: Sepolia
4. Copy your API key from the app dashboard
5. Your RPC URL will be: `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`

### Option B: Infura

1. Go to https://infura.io
2. Sign up for a free account
3. Create a new project
4. Copy your project ID
5. Your RPC URL will be: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

---

## Step 3: Get Your Private Key from MetaMask

⚠️ **WARNING**: Never share your private key or commit it to git!

1. Open MetaMask
2. Click on the three dots menu
3. Select "Account Details"
4. Click "Export Private Key"
5. Enter your password
6. Copy the private key (without the `0x` prefix)

---

## Step 4: Get Etherscan API Key

1. Go to https://etherscan.io
2. Sign up for an account
3. Go to https://etherscan.io/myapikey
4. Create a new API key
5. Copy the API key

---

## Step 5: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your credentials:
   ```
   PRIVATE_KEY=your_private_key_without_0x
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

3. Make sure `.env` is in `.gitignore` (it already is!)

---

## Step 6: Deploy to Sepolia

1. Compile your contracts:
   ```bash
   npm run compile
   ```

2. Deploy to Sepolia:
   ```bash
   npm run deploy:sepolia
   ```

   Or using npx directly:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

3. Save the contract addresses from the deployment output!

---

## Step 7: Verify Contract on Etherscan

After deployment, verify your contract to make the source code public:

```bash
npx hardhat verify --network sepolia CONTRACT_ADDRESS "Token Name" "SYMBOL"
```

Example:
```bash
npx hardhat verify --network sepolia 0x123... "Test Token A" "TTA"
```

---

## Troubleshooting

### Error: "insufficient funds for intrinsic transaction cost"
- You don't have enough Sepolia ETH. Get more from the faucets above.

### Error: "invalid API key"
- Check that your RPC URL is correct
- Make sure there are no extra spaces in your `.env` file

### Error: "nonce too high"
- Reset your MetaMask account:
  - Settings → Advanced → Clear activity tab data

### Error: "cannot estimate gas"
- Your contract might have an error
- Run tests locally first: `npm test`
- Make sure you're connected to Sepolia network

---

## Viewing Your Contract

After deployment, you can view your contract on Sepolia Etherscan:

```
https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS
```

---

## Interacting with Deployed Contract

Use Hardhat console to interact with your deployed contract:

```bash
npx hardhat console --network sepolia
```

Then in the console:
```javascript
const TestERC20 = await ethers.getContractFactory("TestERC20");
const token = await TestERC20.attach("YOUR_CONTRACT_ADDRESS");

// Mint tokens
await token.mint("RECIPIENT_ADDRESS", ethers.parseEther("1000"));

// Check balance
const balance = await token.balanceOf("ADDRESS");
console.log(ethers.formatEther(balance));
```

---

## Security Best Practices

1. ✅ Never commit your `.env` file
2. ✅ Never share your private key
3. ✅ Use a separate wallet for testnet
4. ✅ Double-check contract addresses before sending transactions
5. ✅ Test everything on local network first
6. ✅ Verify contracts on Etherscan for transparency

---

## Cost Estimation

Deploying TestERC20 to Sepolia typically costs:
- **Gas**: ~500,000 - 800,000 gas
- **Cost**: ~0.001 - 0.002 Sepolia ETH (at ~2 gwei gas price)

This is free testnet ETH, but gives you an idea of mainnet costs.

---

## Next Steps

After successful deployment:

1. ✅ Save contract addresses
2. ✅ Verify contract on Etherscan
3. ✅ Test minting tokens
4. ✅ Update your application with contract addresses
5. ✅ Share Etherscan link with your team

---

## Useful Links

- **Sepolia Etherscan**: https://sepolia.etherscan.io
- **Hardhat Docs**: https://hardhat.org/docs
- **Ethers.js Docs**: https://docs.ethers.org/v6/
- **OpenZeppelin Docs**: https://docs.openzeppelin.com/
