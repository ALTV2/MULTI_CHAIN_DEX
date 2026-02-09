const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying remaining contracts to Polygon network...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "POL");

  // Already deployed contracts
  const tokenManagerAddress = "0x3241Fc31fe186660d467DDb1c841EAA7ecaea6C1";
  const orderBookAddress = "0x22763589e1dd35d1FE86c51B0593E71677d72054";
  const tradeAddress = "0xaE925718310E5aDF3Fa2d98c186BfbBEcC0D7cD5";
  const htlcAddress = "0x3d857Fc3510246A050817C29ea7C434ab7EbA81A";

  // Deploy CrossChainOrderBook
  console.log("\n1. Deploying CrossChainOrderBook...");
  const CrossChainOrderBook = await hre.ethers.getContractFactory("contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook");
  const crossChainOrderBook = await CrossChainOrderBook.deploy();
  await crossChainOrderBook.waitForDeployment();
  const crossChainOrderBookAddress = await crossChainOrderBook.getAddress();
  console.log("CrossChainOrderBook deployed to:", crossChainOrderBookAddress);

  // Add Ethereum Sepolia as supported chain (chainId: 11155111)
  console.log("\n2. Adding Ethereum Sepolia as supported chain...");
  const addChainTx = await crossChainOrderBook.addSupportedChain(11155111);
  await addChainTx.wait();
  console.log("Ethereum Sepolia added as supported chain");

  // Deploy test tokens
  console.log("\n3. Deploying test tokens...");
  const TestERC20 = await hre.ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");

  const testTokenA = await TestERC20.deploy("Test Token A Polygon", "pTKA", 18);
  await testTokenA.waitForDeployment();
  const testTokenAAddress = await testTokenA.getAddress();
  console.log("TestTokenA deployed to:", testTokenAAddress);

  const testTokenB = await TestERC20.deploy("Test Token B Polygon", "pTKB", 18);
  await testTokenB.waitForDeployment();
  const testTokenBAddress = await testTokenB.getAddress();
  console.log("TestTokenB deployed to:", testTokenBAddress);

  // Save full deployment info
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

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", hre.ethers.formatEther(finalBalance), "POL");

  console.log("\n========== FULL DEPLOYMENT SUMMARY ==========");
  console.log("TokenManager:", tokenManagerAddress);
  console.log("OrderBook:", orderBookAddress);
  console.log("Trade:", tradeAddress);
  console.log("HTLC:", htlcAddress);
  console.log("CrossChainOrderBook:", crossChainOrderBookAddress);
  console.log("TestTokenA:", testTokenAAddress);
  console.log("TestTokenB:", testTokenBAddress);
  console.log("=============================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
