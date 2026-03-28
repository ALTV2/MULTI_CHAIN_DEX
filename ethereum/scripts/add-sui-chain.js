const hre = require("hardhat");

async function main() {
  const CCOB_ADDRESS = "0x6A78740f7D35818D30e23ebD5A5880A1836aa445";
  const SUI_CHAIN_ID = 101;

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ccob = await hre.ethers.getContractAt("CrossChainOrderBook", CCOB_ADDRESS);
  
  // Check if already supported
  const alreadySupported = await ccob.supportedChains(SUI_CHAIN_ID);
  if (alreadySupported) {
    console.log(`Chain ${SUI_CHAIN_ID} already supported on Sepolia CCOB`);
    return;
  }

  console.log(`Adding chain ${SUI_CHAIN_ID} (SUI) to Sepolia CCOB...`);
  const tx = await ccob.addSupportedChain(SUI_CHAIN_ID);
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("Done! SUI (101) added to Sepolia CCOB");
}

main().catch(console.error);
