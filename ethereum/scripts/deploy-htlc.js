const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying HTLC contracts to Ethereum Sepolia...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy HTLC
  console.log("\n1. Deploying HTLC...");
  const HTLC = await hre.ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  const htlcAddress = await htlc.getAddress();
  console.log("HTLC deployed to:", htlcAddress);

  // Deploy CrossChainOrderBook
  console.log("\n2. Deploying CrossChainOrderBook...");
  const CCOB = await hre.ethers.getContractFactory("contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook");
  const ccob = await CCOB.deploy();
  await ccob.waitForDeployment();
  const ccobAddress = await ccob.getAddress();
  console.log("CrossChainOrderBook deployed to:", ccobAddress);

  // Add Polygon Amoy (80002) as supported chain
  console.log("\n3. Adding Polygon Amoy as supported chain...");
  let tx = await ccob.addSupportedChain(80002);
  await tx.wait();
  console.log("Added Polygon Amoy (80002)");

  // Save deployment info
  const existingInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  existingInfo.contracts.HTLC = htlcAddress;
  existingInfo.contracts.CrossChainOrderBook = ccobAddress;
  existingInfo.htlcDeployedAt = new Date().toISOString();
  fs.writeFileSync("deployment-info.json", JSON.stringify(existingInfo, null, 2));

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", hre.ethers.formatEther(finalBalance), "ETH");

  console.log("\n========== HTLC DEPLOYMENT SUMMARY ==========");
  console.log("HTLC:", htlcAddress);
  console.log("CrossChainOrderBook:", ccobAddress);
  console.log("=============================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
