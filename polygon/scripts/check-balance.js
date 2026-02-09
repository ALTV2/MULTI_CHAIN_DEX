const hre = require("hardhat");

async function main() {
  console.log("=".repeat(60));
  console.log("Checking deployer wallet balance...");
  console.log("=".repeat(60));

  // Get network info
  const network = hre.network.name;
  const networkInfo = await hre.ethers.provider.getNetwork();
  const chainId = Number(networkInfo.chainId);

  console.log("\nNetwork Information:");
  console.log("  Network:", network);
  console.log("  Chain ID:", chainId);

  // Validate network
  if (network === "hardhat" || network === "localhost") {
    console.log("\n⚠️  WARNING: You are on a local network.");
    console.log("    This script is meant for testnets/mainnet.");
    return;
  }

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("\nDeployer Wallet:");
  console.log("  Address:", deployer.address);

  // Get balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceInMatic = hre.ethers.formatEther(balance);

  console.log("\nCurrent Balance:");
  console.log("  Raw:", balance.toString(), "wei");
  console.log("  Formatted:", balanceInMatic, "MATIC");

  // Estimate deployment costs
  console.log("\nEstimated Deployment Costs:");
  console.log("  TokenManager:         ~0.0075 MATIC");
  console.log("  OrderBook:            ~0.0225 MATIC");
  console.log("  Trade:                ~0.0150 MATIC");
  console.log("  HTLC:                 ~0.0240 MATIC");
  console.log("  CrossChainOrderBook:  ~0.0360 MATIC");
  console.log("  TestTokenA:           ~0.0060 MATIC");
  console.log("  TestTokenB:           ~0.0060 MATIC");
  console.log("  Configuration txs:    ~0.0030 MATIC");
  console.log("  " + "-".repeat(50));
  console.log("  TOTAL (estimated):    ~0.12 MATIC");

  // Check if balance is sufficient
  const minimumRequired = 0.12;
  const recommended = 0.5;

  console.log("\nBalance Check:");

  if (parseFloat(balanceInMatic) < minimumRequired) {
    console.log("  ❌ INSUFFICIENT - You need at least", minimumRequired, "MATIC");
    console.log("\n  How to get test MATIC:");
    console.log("  1. Visit https://faucet.polygon.technology/");
    console.log("  2. Select 'Polygon Amoy' network");
    console.log("  3. Enter your wallet address:", deployer.address);
    console.log("  4. Complete the captcha and request MATIC");
    console.log("\n  Alternative faucets:");
    console.log("  - https://www.alchemy.com/faucets/polygon-amoy");
    console.log("  - https://faucet.quicknode.com/polygon/amoy");
  } else if (parseFloat(balanceInMatic) < recommended) {
    console.log("  ⚠️  MINIMAL - You have enough but it's close");
    console.log("  Recommended balance:", recommended, "MATIC or more");
  } else {
    console.log("  ✅ SUFFICIENT - You have enough MATIC for deployment");
  }

  // Network-specific information
  if (chainId === 80002) {
    console.log("\n📍 Polygon Amoy Testnet Resources:");
    console.log("  Faucet:   https://faucet.polygon.technology/");
    console.log("  Explorer: https://amoy.polygonscan.com/address/" + deployer.address);
    console.log("  RPC:      https://rpc-amoy.polygon.technology");
  } else if (chainId === 137) {
    console.log("\n📍 Polygon Mainnet:");
    console.log("  ⚠️  You are on MAINNET! This will use real MATIC.");
    console.log("  Explorer: https://polygonscan.com/address/" + deployer.address);
  } else {
    console.log("\n⚠️  Unknown network. Chain ID:", chainId);
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
