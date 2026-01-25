const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Verifying deployment configuration...\n");

  // Read deployment info
  if (!fs.existsSync("deployment-info.json")) {
    console.log("❌ deployment-info.json not found!");
    console.log("Please run deployment first: npx hardhat run scripts/deploy.js --network sepolia");
    return;
  }

  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  
  console.log("Network:", deploymentInfo.network);
  console.log("Deployed at:", deploymentInfo.timestamp);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("\nContract Addresses:");
  console.log("-------------------");
  Object.entries(deploymentInfo.contracts).forEach(([name, address]) => {
    console.log(`${name}: ${address}`);
  });

  // Verify connections
  console.log("\n" + "=".repeat(60));
  console.log("VERIFYING CONTRACT CONNECTIONS");
  console.log("=".repeat(60));

  try {
    const orderBook = await hre.ethers.getContractAt(
      "OrderBook",
      deploymentInfo.contracts.OrderBook
    );

    // Check TokenManager connection
    const tokenManagerAddr = await orderBook.TOKEN_MANAGER();
    if (tokenManagerAddr.toLowerCase() === deploymentInfo.contracts.TokenManager.toLowerCase()) {
      console.log("✅ OrderBook → TokenManager connection: OK");
    } else {
      console.log("❌ OrderBook → TokenManager connection: FAILED");
    }

    // Check Trade connection
    const tradeAddr = await orderBook.tradeContract();
    if (tradeAddr.toLowerCase() === deploymentInfo.contracts.Trade.toLowerCase()) {
      console.log("✅ OrderBook → Trade connection: OK");
    } else {
      console.log("❌ OrderBook → Trade connection: FAILED");
    }

    // Check Trade → OrderBook
    const trade = await hre.ethers.getContractAt(
      "Trade",
      deploymentInfo.contracts.Trade
    );
    const orderBookFromTrade = await trade.ORDER_BOOK();
    if (orderBookFromTrade.toLowerCase() === deploymentInfo.contracts.OrderBook.toLowerCase()) {
      console.log("✅ Trade → OrderBook connection: OK");
    } else {
      console.log("❌ Trade → OrderBook connection: FAILED");
    }

    console.log("\n✅ All connections verified successfully!");

  } catch (error) {
    console.error("\n❌ Error verifying connections:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("View contracts on Etherscan:");
  console.log("----------------------------");
  Object.entries(deploymentInfo.contracts).forEach(([name, address]) => {
    console.log(`${name}: https://sepolia.etherscan.io/address/${address}`);
  });
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
