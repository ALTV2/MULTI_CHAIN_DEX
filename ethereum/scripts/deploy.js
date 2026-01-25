const hre = require("hardhat");

async function main() {
  console.log("Starting deployment to Sepolia...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Step 1: Deploy TokenManager
  console.log("1. Deploying TokenManager...");
  const TokenManager = await hre.ethers.getContractFactory("TokenManager");
  const tokenManager = await TokenManager.deploy(deployer.address);
  await tokenManager.waitForDeployment();
  const tokenManagerAddress = await tokenManager.getAddress();
  console.log("✅ TokenManager deployed to:", tokenManagerAddress);

  // Step 2: Deploy OrderBook
  console.log("\n2. Deploying OrderBook...");
  const OrderBook = await hre.ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(tokenManagerAddress);
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();
  console.log("✅ OrderBook deployed to:", orderBookAddress);

  // Step 3: Deploy Trade
  console.log("\n3. Deploying Trade...");
  const Trade = await hre.ethers.getContractFactory("Trade");
  const trade = await Trade.deploy(orderBookAddress);
  await trade.waitForDeployment();
  const tradeAddress = await trade.getAddress();
  console.log("✅ Trade deployed to:", tradeAddress);

  // Step 4: Set Trade contract in OrderBook
  console.log("\n4. Setting Trade contract in OrderBook...");
  const setTradeTx = await orderBook.setTradeContract(tradeAddress);
  await setTradeTx.wait();
  console.log("✅ Trade contract set in OrderBook");

  // Step 5: Deploy TestERC20 tokens (optional, for testing)
  console.log("\n5. Deploying test tokens (optional)...");
  const TestERC20 = await hre.ethers.getContractFactory("TestERC20");
  
  const tokenA = await TestERC20.deploy("Test Token A", "TKA");
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("✅ Test Token A deployed to:", tokenAAddress);

  const tokenB = await TestERC20.deploy("Test Token B", "TKB");
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("✅ Test Token B deployed to:", tokenBAddress);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log("TokenManager:", tokenManagerAddress);
  console.log("OrderBook:   ", orderBookAddress);
  console.log("Trade:       ", tradeAddress);
  console.log("Test Token A:", tokenAAddress);
  console.log("Test Token B:", tokenBAddress);
  console.log("=".repeat(60));

  // Save deployment info to file
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      TokenManager: tokenManagerAddress,
      OrderBook: orderBookAddress,
      Trade: tradeAddress,
      TestTokenA: tokenAAddress,
      TestTokenB: tokenBAddress
    }
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n✅ Deployment info saved to deployment-info.json");

  // Verification instructions
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS: Contract Verification");
  console.log("=".repeat(60));
  console.log("To verify your contracts on Etherscan, run:");
  console.log("\nnpx hardhat verify --network sepolia " + tokenManagerAddress + " " + deployer.address);
  console.log("npx hardhat verify --network sepolia " + orderBookAddress + " " + tokenManagerAddress);
  console.log("npx hardhat verify --network sepolia " + tradeAddress + " " + orderBookAddress);
  console.log("npx hardhat verify --network sepolia " + tokenAAddress + ' "Test Token A" "TKA"');
  console.log("npx hardhat verify --network sepolia " + tokenBAddress + ' "Test Token B" "TKB"');
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
