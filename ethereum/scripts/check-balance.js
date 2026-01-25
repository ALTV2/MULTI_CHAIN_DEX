const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Checking balance for:", deployer.address);
  console.log("Network:", hre.network.name);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceInEth = hre.ethers.formatEther(balance);
  
  console.log("\nBalance:", balanceInEth, "ETH");
  
  const requiredBalance = 0.05; // minimum required
  const recommendedBalance = 0.1; // recommended
  
  if (parseFloat(balanceInEth) < requiredBalance) {
    console.log("\n⚠️  WARNING: Insufficient balance!");
    console.log("Required minimum:", requiredBalance, "ETH");
    console.log("Please get test ETH from: https://sepoliafaucet.com/");
  } else if (parseFloat(balanceInEth) < recommendedBalance) {
    console.log("\n⚠️  Balance is low but sufficient.");
    console.log("Recommended balance:", recommendedBalance, "ETH");
  } else {
    console.log("\n✅ Balance is sufficient for deployment!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
