const hre = require("hardhat");

async function main() {
  console.log("Deploying TestERC20 token...");

  const TestERC20 = await hre.ethers.getContractFactory("TestERC20");

  // Деплоим первый тестовый токен
  const token1 = await TestERC20.deploy("Test Token A", "TTA");
  await token1.waitForDeployment();
  const token1Address = await token1.getAddress();

  console.log(`TestToken A deployed to: ${token1Address}`);

  // Деплоим второй тестовый токен
  const token2 = await TestERC20.deploy("Test Token B", "TTB");
  await token2.waitForDeployment();
  const token2Address = await token2.getAddress();

  console.log(`TestToken B deployed to: ${token2Address}`);

  // Минтим начальное количество токенов
  const [deployer] = await hre.ethers.getSigners();
  const mintAmount = hre.ethers.parseEther("1000000"); // 1 миллион токенов

  console.log("\nMinting initial tokens...");

  await token1.mint(deployer.address, mintAmount);
  console.log(`Minted ${hre.ethers.formatEther(mintAmount)} TTA to ${deployer.address}`);

  await token2.mint(deployer.address, mintAmount);
  console.log(`Minted ${hre.ethers.formatEther(mintAmount)} TTB to ${deployer.address}`);

  console.log("\nDeployment summary:");
  console.log("===================");
  console.log(`Token A (TTA): ${token1Address}`);
  console.log(`Token B (TTB): ${token2Address}`);
  console.log(`Deployer: ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
