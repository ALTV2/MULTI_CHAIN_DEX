const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying HTLC contracts to Polygon network...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Deploy HTLC
  console.log("\n1. Deploying HTLC...");
  const HTLC = await hre.ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  const htlcAddress = await htlc.getAddress();
  console.log("HTLC deployed to:", htlcAddress);

  // Deploy CrossChainOrderBook
  console.log("\n2. Deploying CrossChainOrderBook...");
  const CrossChainOrderBook = await hre.ethers.getContractFactory("contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook");
  const crossChainOrderBook = await CrossChainOrderBook.deploy();
  await crossChainOrderBook.waitForDeployment();
  const crossChainOrderBookAddress = await crossChainOrderBook.getAddress();
  console.log("CrossChainOrderBook deployed to:", crossChainOrderBookAddress);

  // Add supported chains
  console.log("\n3. Adding supported chains...");

  // Add Ethereum Sepolia (11155111)
  let tx = await crossChainOrderBook.addSupportedChain(11155111);
  await tx.wait();
  console.log("Added Ethereum Sepolia (11155111)");

  // Add Ethereum Mainnet (1)
  tx = await crossChainOrderBook.addSupportedChain(1);
  await tx.wait();
  console.log("Added Ethereum Mainnet (1)");

  // Add Polygon Mainnet (137)
  tx = await crossChainOrderBook.addSupportedChain(137);
  await tx.wait();
  console.log("Added Polygon Mainnet (137)");

  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    contracts: {
      HTLC: htlcAddress,
      CrossChainOrderBook: crossChainOrderBookAddress
    },
    supportedChains: [11155111, 1, 137, 80002],
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    "htlc-deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n========== HTLC DEPLOYMENT SUMMARY ==========");
  console.log("HTLC:", htlcAddress);
  console.log("CrossChainOrderBook:", crossChainOrderBookAddress);
  console.log("=============================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
