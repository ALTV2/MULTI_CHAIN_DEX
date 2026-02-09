const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "POL");

  // Get current gas price from network
  const feeData = await hre.ethers.provider.getFeeData();
  console.log("Network gas price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");

  // Deploy CrossChainOrderBook with explicit low gas price
  console.log("\nDeploying CrossChainOrderBook...");
  const factory = await hre.ethers.getContractFactory("contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook");

  // Estimate gas first
  const deployTx = await factory.getDeployTransaction();
  const estimatedGas = await hre.ethers.provider.estimateGas(deployTx);
  console.log("Estimated gas:", estimatedGas.toString());

  // Use 26 gwei - just above minimum 25 gwei
  const gasPrice = hre.ethers.parseUnits("26", "gwei");
  const totalCost = estimatedGas * gasPrice;
  console.log("Total cost at 26 gwei:", hre.ethers.formatEther(totalCost), "POL");

  if (totalCost > balance) {
    console.log("INSUFFICIENT FUNDS. Need", hre.ethers.formatEther(totalCost - balance), "more POL");
    process.exit(1);
  }

  const contract = await factory.deploy({ gasPrice });
  console.log("Tx hash:", contract.deploymentTransaction().hash);
  console.log("Waiting for confirmation...");
  await contract.waitForDeployment();
  console.log("CrossChainOrderBook deployed to:", await contract.getAddress());

  // Add Sepolia chain
  console.log("\nAdding Sepolia as supported chain...");
  const tx = await contract.addSupportedChain(11155111, { gasPrice });
  await tx.wait();
  console.log("Done!");

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\nFinal balance:", hre.ethers.formatEther(finalBalance), "POL");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
