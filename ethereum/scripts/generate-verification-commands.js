const fs = require("fs");

async function main() {
  if (!fs.existsSync("deployment-info.json")) {
    console.log("❌ deployment-info.json not found!");
    console.log("Please run deployment first.");
    return;
  }

  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  const contracts = deploymentInfo.contracts;

  console.log("=".repeat(70));
  console.log("VERIFICATION COMMANDS FOR ETHERSCAN");
  console.log("=".repeat(70));
  console.log("\nCopy and paste these commands one by one:\n");

  console.log("# 1. TokenManager");
  console.log(`npx hardhat verify --network sepolia ${contracts.TokenManager} ${deploymentInfo.deployer}\n`);

  console.log("# 2. OrderBook");
  console.log(`npx hardhat verify --network sepolia ${contracts.OrderBook} ${contracts.TokenManager}\n`);

  console.log("# 3. Trade");
  console.log(`npx hardhat verify --network sepolia ${contracts.Trade} ${contracts.OrderBook}\n`);

  console.log("# 4. Test Token A");
  console.log(`npx hardhat verify --network sepolia ${contracts.TestTokenA} "Test Token A" "TKA"\n`);

  console.log("# 5. Test Token B");
  console.log(`npx hardhat verify --network sepolia ${contracts.TestTokenB} "Test Token B" "TKB"\n`);

  console.log("=".repeat(70));

  // Save to file
  const commands = `# Verification commands for Sepolia deployment
# Generated: ${new Date().toISOString()}

# TokenManager
npx hardhat verify --network sepolia ${contracts.TokenManager} ${deploymentInfo.deployer}

# OrderBook
npx hardhat verify --network sepolia ${contracts.OrderBook} ${contracts.TokenManager}

# Trade
npx hardhat verify --network sepolia ${contracts.Trade} ${contracts.OrderBook}

# Test Token A
npx hardhat verify --network sepolia ${contracts.TestTokenA} "Test Token A" "TKA"

# Test Token B
npx hardhat verify --network sepolia ${contracts.TestTokenB} "Test Token B" "TKB"
`;

  fs.writeFileSync("verify-commands.sh", commands);
  console.log("\n✅ Commands saved to verify-commands.sh");
  console.log("You can run: bash verify-commands.sh\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
