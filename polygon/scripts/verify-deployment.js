const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=".repeat(60));
  console.log("Verifying Deployment Configuration...");
  console.log("=".repeat(60));

  // Check if deployment-info.json exists
  if (!fs.existsSync("deployment-info.json")) {
    console.log("\n❌ ERROR: deployment-info.json not found!");
    console.log("   Please run deployment first:");
    console.log("   npx hardhat run scripts/deploy.js --network polygonAmoy");
    process.exit(1);
  }

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  const contracts = deploymentInfo.contracts;

  console.log("\nDeployment Info:");
  console.log("  Network:", deploymentInfo.network);
  console.log("  Chain ID:", deploymentInfo.chainId);
  console.log("  Deployed at:", deploymentInfo.deployedAt);
  console.log("  Deployer:", deploymentInfo.deployer);

  console.log("\nContract Addresses:");
  console.log("  TokenManager:", contracts.TokenManager);
  console.log("  OrderBook:", contracts.OrderBook);
  console.log("  Trade:", contracts.Trade);
  console.log("  HTLC:", contracts.HTLC);
  console.log("  CrossChainOrderBook:", contracts.CrossChainOrderBook);
  console.log("  TestTokenA:", contracts.TestTokenA);
  console.log("  TestTokenB:", contracts.TestTokenB);

  let allChecksPass = true;

  // Connect to contracts
  console.log("\n" + "=".repeat(60));
  console.log("Running Verification Checks...");
  console.log("=".repeat(60));

  try {
    // 1. Check TokenManager
    console.log("\n[1/7] TokenManager contract...");
    const TokenManager = await hre.ethers.getContractFactory("contracts/core/TokenManager.sol:TokenManager");
    const tokenManager = TokenManager.attach(contracts.TokenManager);

    const tmOwner = await tokenManager.owner();
    console.log("  ✅ Owner:", tmOwner);

    // 2. Check OrderBook
    console.log("\n[2/7] OrderBook contract...");
    const OrderBook = await hre.ethers.getContractFactory("contracts/core/OrderBook.sol:OrderBook");
    const orderBook = OrderBook.attach(contracts.OrderBook);

    const obTokenManager = await orderBook.tokenManager();
    const obTradeContract = await orderBook.tradeContract();

    if (obTokenManager.toLowerCase() === contracts.TokenManager.toLowerCase()) {
      console.log("  ✅ TokenManager reference:", obTokenManager);
    } else {
      console.log("  ❌ TokenManager mismatch!");
      console.log("     Expected:", contracts.TokenManager);
      console.log("     Got:", obTokenManager);
      allChecksPass = false;
    }

    if (obTradeContract.toLowerCase() === contracts.Trade.toLowerCase()) {
      console.log("  ✅ Trade contract reference:", obTradeContract);
    } else {
      console.log("  ❌ Trade contract mismatch!");
      console.log("     Expected:", contracts.Trade);
      console.log("     Got:", obTradeContract);
      allChecksPass = false;
    }

    // 3. Check Trade
    console.log("\n[3/7] Trade contract...");
    const Trade = await hre.ethers.getContractFactory("contracts/core/Trade.sol:Trade");
    const trade = Trade.attach(contracts.Trade);

    const tradeOrderBook = await trade.orderBook();

    if (tradeOrderBook.toLowerCase() === contracts.OrderBook.toLowerCase()) {
      console.log("  ✅ OrderBook reference:", tradeOrderBook);
    } else {
      console.log("  ❌ OrderBook mismatch!");
      console.log("     Expected:", contracts.OrderBook);
      console.log("     Got:", tradeOrderBook);
      allChecksPass = false;
    }

    // 4. Check HTLC
    console.log("\n[4/7] HTLC contract...");
    const HTLC = await hre.ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
    const htlc = HTLC.attach(contracts.HTLC);

    // Try to call a view function to verify contract is working
    const htlcCode = await hre.ethers.provider.getCode(contracts.HTLC);
    if (htlcCode !== "0x") {
      console.log("  ✅ Contract deployed and has bytecode");
    } else {
      console.log("  ❌ Contract has no bytecode!");
      allChecksPass = false;
    }

    // 5. Check CrossChainOrderBook
    console.log("\n[5/7] CrossChainOrderBook contract...");
    const CrossChainOrderBook = await hre.ethers.getContractFactory("contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook");
    const crossChainOrderBook = CrossChainOrderBook.attach(contracts.CrossChainOrderBook);

    // Check if Ethereum Sepolia is supported (chainId: 11155111)
    const isSepoliaSupported = await crossChainOrderBook.supportedChains(11155111);

    if (isSepoliaSupported) {
      console.log("  ✅ Ethereum Sepolia (chainId: 11155111) is supported");
    } else {
      console.log("  ⚠️  Ethereum Sepolia not configured as supported chain");
      console.log("     This may be intentional if cross-chain is not needed yet");
    }

    const orderCount = await crossChainOrderBook.orderCount();
    console.log("  ✅ Current order count:", orderCount.toString());

    // 6. Check TestTokenA
    console.log("\n[6/7] TestTokenA contract...");
    const TestERC20A = await hre.ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");
    const testTokenA = TestERC20A.attach(contracts.TestTokenA);

    const tokenAName = await testTokenA.name();
    const tokenASymbol = await testTokenA.symbol();
    const tokenADecimals = await testTokenA.decimals();

    console.log("  ✅ Name:", tokenAName);
    console.log("  ✅ Symbol:", tokenASymbol);
    console.log("  ✅ Decimals:", tokenADecimals);

    // 7. Check TestTokenB
    console.log("\n[7/7] TestTokenB contract...");
    const TestERC20B = await hre.ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");
    const testTokenB = TestERC20B.attach(contracts.TestTokenB);

    const tokenBName = await testTokenB.name();
    const tokenBSymbol = await testTokenB.symbol();
    const tokenBDecimals = await testTokenB.decimals();

    console.log("  ✅ Name:", tokenBName);
    console.log("  ✅ Symbol:", tokenBSymbol);
    console.log("  ✅ Decimals:", tokenBDecimals);

  } catch (error) {
    console.log("\n❌ Verification failed:", error.message);
    allChecksPass = false;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Verification Summary");
  console.log("=".repeat(60));

  if (allChecksPass) {
    console.log("\n✅ All checks passed!");
    console.log("\nYour contracts are properly configured and ready to use.");
    console.log("\nNext steps:");
    console.log("  1. Verify contracts on PolygonScan (optional)");
    console.log("  2. Update frontend with contract addresses");
    console.log("  3. Test basic functionality (mint, approve, create orders)");
    console.log("  4. Configure backend to listen to contract events");
  } else {
    console.log("\n❌ Some checks failed!");
    console.log("\nPlease review the errors above and fix any issues.");
    console.log("You may need to redeploy some contracts.");
  }

  // Show explorer links
  const network = deploymentInfo.network;
  let explorerUrl = "";

  if (deploymentInfo.chainId === 80002) {
    explorerUrl = "https://amoy.polygonscan.com";
  } else if (deploymentInfo.chainId === 137) {
    explorerUrl = "https://polygonscan.com";
  }

  if (explorerUrl) {
    console.log("\n" + "=".repeat(60));
    console.log("View on Block Explorer");
    console.log("=".repeat(60));
    console.log("\nTokenManager:");
    console.log("  " + explorerUrl + "/address/" + contracts.TokenManager);
    console.log("\nOrderBook:");
    console.log("  " + explorerUrl + "/address/" + contracts.OrderBook);
    console.log("\nTrade:");
    console.log("  " + explorerUrl + "/address/" + contracts.Trade);
    console.log("\nHTLC:");
    console.log("  " + explorerUrl + "/address/" + contracts.HTLC);
    console.log("\nCrossChainOrderBook:");
    console.log("  " + explorerUrl + "/address/" + contracts.CrossChainOrderBook);
  }

  console.log("\n" + "=".repeat(60));

  process.exit(allChecksPass ? 0 : 1);
}

main()
  .then(() => {})
  .catch((error) => {
    console.error("\n❌ Script error:", error);
    process.exit(1);
  });
