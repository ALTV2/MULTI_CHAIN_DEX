const hre = require("hardhat");

/**
 * Script to mint test tokens to any address
 * 
 * Usage:
 * npx hardhat run scripts/mint-tokens.js --network sepolia
 * 
 * Or with custom parameters:
 * TOKEN_ADDRESS=0x... RECIPIENT=0x... AMOUNT=1000 npx hardhat run scripts/mint-tokens.js --network sepolia
 */

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("\n🪙 Minting Test Tokens");
  console.log("=====================");
  console.log("Deployer:", deployer.address);
  
  // Get parameters from environment or use defaults from deployment-info.json
  let tokenAddress = process.env.TOKEN_ADDRESS;
  let recipient = process.env.RECIPIENT || deployer.address;
  let amount = process.env.AMOUNT || "1000"; // Default: 1000 tokens
  
  // If no token address provided, ask user to choose or use deployment info
  if (!tokenAddress) {
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '../deployment-info.json');
    
    if (fs.existsSync(deploymentPath)) {
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      
      console.log("\n📋 Available Test Tokens:");
      console.log("1. TestTokenA:", deploymentInfo.contracts.TestTokenA);
      console.log("2. TestTokenB:", deploymentInfo.contracts.TestTokenB);
      console.log("\n💡 Usage:");
      console.log("   Mint TokenA: TOKEN_ADDRESS=" + deploymentInfo.contracts.TestTokenA + " RECIPIENT=0x... AMOUNT=1000 npm run mint");
      console.log("   Mint TokenB: TOKEN_ADDRESS=" + deploymentInfo.contracts.TestTokenB + " RECIPIENT=0x... AMOUNT=1000 npm run mint");
      console.log("\n⚠️  Please set TOKEN_ADDRESS environment variable and run again.");
      process.exit(0);
    } else {
      console.error("❌ Error: deployment-info.json not found and TOKEN_ADDRESS not provided");
      console.log("\n💡 Usage:");
      console.log("   TOKEN_ADDRESS=0xYourTokenAddress RECIPIENT=0xRecipientAddress AMOUNT=1000 npx hardhat run scripts/mint-tokens.js --network sepolia");
      process.exit(1);
    }
  }
  
  // Validate addresses
  if (!hre.ethers.isAddress(tokenAddress)) {
    console.error("❌ Error: Invalid TOKEN_ADDRESS:", tokenAddress);
    process.exit(1);
  }
  
  if (!hre.ethers.isAddress(recipient)) {
    console.error("❌ Error: Invalid RECIPIENT address:", recipient);
    process.exit(1);
  }
  
  console.log("\n📝 Mint Parameters:");
  console.log("Token Contract:", tokenAddress);
  console.log("Recipient:", recipient);
  console.log("Amount:", amount, "tokens");
  
  // Connect to token contract
  const tokenArtifact = await hre.artifacts.readArtifact("TestERC20");
  const token = await hre.ethers.getContractAt(tokenArtifact.abi, tokenAddress);
  
  // Get token info
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    
    console.log("\n🪙 Token Info:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals);
    
    // Convert amount to proper decimals
    const amountWithDecimals = hre.ethers.parseUnits(amount, decimals);
    console.log("Amount (with decimals):", amountWithDecimals.toString());
    
    // Check if deployer is owner
    const owner = await token.owner();
    console.log("\n🔐 Owner:", owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("❌ Error: Deployer is not the owner of the token contract");
      console.log("   Token owner:", owner);
      console.log("   Your address:", deployer.address);
      process.exit(1);
    }
    
    // Get balance before minting
    const balanceBefore = await token.balanceOf(recipient);
    console.log("\n💰 Balance Before:", hre.ethers.formatUnits(balanceBefore, decimals), symbol);
    
    // Mint tokens
    console.log("\n⏳ Minting tokens...");
    const tx = await token.mint(recipient, amountWithDecimals);
    console.log("Transaction hash:", tx.hash);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Get balance after minting
    const balanceAfter = await token.balanceOf(recipient);
    console.log("\n💰 Balance After:", hre.ethers.formatUnits(balanceAfter, decimals), symbol);
    console.log("💸 Minted:", hre.ethers.formatUnits(balanceAfter - balanceBefore, decimals), symbol);
    
    console.log("\n✅ Successfully minted", amount, symbol, "to", recipient);
    
    // Show Etherscan link
    const network = await hre.ethers.provider.getNetwork();
    if (network.chainId === 11155111n) { // Sepolia
      console.log("\n🔍 View on Etherscan:");
      console.log("   Transaction:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
      console.log("   Token:", `https://sepolia.etherscan.io/token/${tokenAddress}`);
      console.log("   Recipient:", `https://sepolia.etherscan.io/address/${recipient}`);
    }
    
  } catch (error) {
    console.error("\n❌ Error minting tokens:", error.message);
    
    if (error.message.includes("OwnableUnauthorizedAccount")) {
      console.log("\n💡 Tip: Make sure you're using the correct private key (token owner's key)");
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
