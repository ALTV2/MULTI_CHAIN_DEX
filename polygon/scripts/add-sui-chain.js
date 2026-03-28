const hre = require("hardhat");

async function main() {
  const CCOB_ADDRESS = "0x5F08Ec67A95C4394d577c90c65083AEb119BD922";
  const SUI_CHAIN_ID = 101;

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ccob = await hre.ethers.getContractAt("CrossChainOrderBook", CCOB_ADDRESS);
  
  const alreadySupported = await ccob.supportedChains(SUI_CHAIN_ID);
  if (alreadySupported) {
    console.log(`Chain ${SUI_CHAIN_ID} already supported on Polygon CCOB`);
    return;
  }

  console.log(`Adding chain ${SUI_CHAIN_ID} (SUI) to Polygon Amoy CCOB...`);
  const tx = await ccob.addSupportedChain(SUI_CHAIN_ID, {
    maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
    maxFeePerGas: hre.ethers.parseUnits("50", "gwei"),
  });
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("Done! SUI (101) added to Polygon Amoy CCOB");
}

main().catch(console.error);
