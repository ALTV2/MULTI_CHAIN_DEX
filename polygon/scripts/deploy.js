const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting deployment to Polygon network...");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "MATIC");

  // Deploy TokenManager
  console.log("\n1. Deploying TokenManager...");
  const TokenManager = await hre.ethers.getContractFactory("contracts/core/TokenManager.sol:TokenManager");
  const tokenManager = await TokenManager.deploy(deployer.address);
  await tokenManager.waitForDeployment();
  const tokenManagerAddress = await tokenManager.getAddress();
  console.log("TokenManager deployed to:", tokenManagerAddress);

  // Deploy OrderBook
  console.log("\n2. Deploying OrderBook...");
  const OrderBook = await hre.ethers.getContractFactory("contracts/core/OrderBook.sol:OrderBook");
  const orderBook = await OrderBook.deploy(tokenManagerAddress);
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();
  console.log("OrderBook deployed to:", orderBookAddress);

  // Deploy Trade
  console.log("\n3. Deploying Trade...");
  const Trade = await hre.ethers.getContractFactory("contracts/core/Trade.sol:Trade");
  const trade = await Trade.deploy(orderBookAddress);
  await trade.waitForDeployment();
  const tradeAddress = await trade.getAddress();
  console.log("Trade deployed to:", tradeAddress);

  // Set Trade contract in OrderBook
  console.log("\n4. Setting Trade contract in OrderBook...");
  const setTradeTx = await orderBook.setTradeContract(tradeAddress);
  await setTradeTx.wait();
  console.log("Trade contract set in OrderBook");

  // Deploy HTLC
  console.log("\n5. Deploying HTLC...");
  const HTLC = await hre.ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  const htlcAddress = await htlc.getAddress();
  console.log("HTLC deployed to:", htlcAddress);

  // Deploy CrossChainOrderBook
  console.log("\n6. Deploying CrossChainOrderBook...");
  const CrossChainOrderBook = await hre.ethers.getContractFactory("contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook");
  const crossChainOrderBook = await CrossChainOrderBook.deploy();
  await crossChainOrderBook.waitForDeployment();
  const crossChainOrderBookAddress = await crossChainOrderBook.getAddress();
  console.log("CrossChainOrderBook deployed to:", crossChainOrderBookAddress);

  // Add Ethereum Sepolia as supported chain (chainId: 11155111)
  console.log("\n7. Adding Ethereum Sepolia as supported chain...");
  const addChainTx = await crossChainOrderBook.addSupportedChain(11155111);
  await addChainTx.wait();
  console.log("Ethereum Sepolia added as supported chain");

  // Deploy test tokens
  console.log("\n8. Deploying test tokens...");
  const TestERC20 = await hre.ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");

  const testTokenA = await TestERC20.deploy("Test Token A Polygon", "pTKA", 18);
  await testTokenA.waitForDeployment();
  const testTokenAAddress = await testTokenA.getAddress();
  console.log("TestTokenA deployed to:", testTokenAAddress);

  const testTokenB = await TestERC20.deploy("Test Token B Polygon", "pTKB", 18);
  await testTokenB.waitForDeployment();
  const testTokenBAddress = await testTokenB.getAddress();
  console.log("TestTokenB deployed to:", testTokenBAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    contracts: {
      TokenManager: tokenManagerAddress,
      OrderBook: orderBookAddress,
      Trade: tradeAddress,
      HTLC: htlcAddress,
      CrossChainOrderBook: crossChainOrderBookAddress,
      TestTokenA: testTokenAAddress,
      TestTokenB: testTokenBAddress
    },
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment-info.json");

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("TokenManager:", tokenManagerAddress);
  console.log("OrderBook:", orderBookAddress);
  console.log("Trade:", tradeAddress);
  console.log("HTLC:", htlcAddress);
  console.log("CrossChainOrderBook:", crossChainOrderBookAddress);
  console.log("TestTokenA:", testTokenAAddress);
  console.log("TestTokenB:", testTokenBAddress);
  console.log("=========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
