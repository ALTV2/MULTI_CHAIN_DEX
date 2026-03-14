#!/usr/bin/env node
/**
 * Post-deploy setup for local chains:
 * 1. Adds cross-chain pairs (31337 ↔ 31338) to CrossChainOrderBook on both chains
 * 2. Mints test tokens to specified wallets
 *
 * Run AFTER deploy-local.sh:
 *   node scripts/setup-local.js
 */

const { ethers } = require("../ethereum/node_modules/ethers");
const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const ETH_RPC     = "http://127.0.0.1:8545";
const POLYGON_RPC = "http://127.0.0.1:8546";
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const MINT_AMOUNT = ethers.parseEther("10000"); // 10,000 tokens per wallet

// Wallets to receive test tokens
const MINT_WALLETS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Anvil account #0 (deployer)
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Anvil account #1
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Anvil account #2
  "0x7C26774eC3c296510f73abFB04E6e5892E372CF9", // Custom test wallet
];

// Minimal ABIs
const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

const CCOB_ABI = [
  "function addSupportedChain(uint256 _chainId) external",
  "function supportedChains(uint256) view returns (bool)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function readDeployInfo(dir) {
  const file = path.join(__dirname, "..", dir, "deployment-info.json");
  if (!fs.existsSync(file)) throw new Error(`deployment-info.json not found in ${dir}/`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET  = "\x1b[0m";
const info   = (msg) => console.log(`${GREEN}[INFO]${RESET} ${msg}`);
const warn   = (msg) => console.log(`${YELLOW}[WARN]${RESET} ${msg}`);

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n=============================================");
  console.log("  Local Chain Setup");
  console.log("=============================================\n");

  const ethInfo  = readDeployInfo("ethereum");
  const polyInfo = readDeployInfo("polygon");

  const ethProvider  = new ethers.JsonRpcProvider(ETH_RPC);
  const polyProvider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const ethSigner    = new ethers.Wallet(DEPLOYER_KEY, ethProvider);
  const polySigner   = new ethers.Wallet(DEPLOYER_KEY, polyProvider);

  // ── Step 1: Cross-chain pairs ───────────────────────────────────────────────
  info("=== Step 1: Configure cross-chain pairs ===");

  // Local ETH CCOB → knows all other chains: local Polygon, Sepolia, Polygon Amoy
  // Local Polygon CCOB → knows all other chains: local ETH, Sepolia, Polygon Amoy
  const ETH_CCOB_CHAINS  = [31338, 11155111, 80002];
  const POLY_CCOB_CHAINS = [31337, 11155111, 80002];

  const ethCCOB = new ethers.Contract(
    ethInfo.contracts.CrossChainOrderBook, CCOB_ABI, ethSigner
  );
  for (const chainId of ETH_CCOB_CHAINS) {
    const already = await ethCCOB.supportedChains(chainId);
    if (already) {
      info(`ETH CCOB: chain ${chainId} already supported`);
    } else {
      info(`ETH CCOB: Adding chain ${chainId}...`);
      const tx = await ethCCOB.addSupportedChain(chainId);
      await tx.wait();
      info(`ETH CCOB: ✅ chain ${chainId} added  [tx: ${tx.hash}]`);
    }
  }

  const polyCCOB = new ethers.Contract(
    polyInfo.contracts.CrossChainOrderBook, CCOB_ABI, polySigner
  );
  for (const chainId of POLY_CCOB_CHAINS) {
    const already = await polyCCOB.supportedChains(chainId);
    if (already) {
      info(`Polygon CCOB: chain ${chainId} already supported`);
    } else {
      info(`Polygon CCOB: Adding chain ${chainId}...`);
      const tx = await polyCCOB.addSupportedChain(chainId);
      await tx.wait();
      info(`Polygon CCOB: ✅ chain ${chainId} added  [tx: ${tx.hash}]`);
    }
  }

  // ── Step 2: Mint tokens ─────────────────────────────────────────────────────
  info("\n=== Step 2: Mint test tokens ===");

  const ethTKA  = new ethers.Contract(ethInfo.contracts.TestTokenA,  ERC20_ABI, ethSigner);
  const ethTKB  = new ethers.Contract(ethInfo.contracts.TestTokenB,  ERC20_ABI, ethSigner);
  const polyTKA = new ethers.Contract(polyInfo.contracts.TestTokenA, ERC20_ABI, polySigner);
  const polyTKB = new ethers.Contract(polyInfo.contracts.TestTokenB, ERC20_ABI, polySigner);

  const ethSymA  = await ethTKA.symbol();
  const ethSymB  = await ethTKB.symbol();
  const polySymA = await polyTKA.symbol();
  const polySymB = await polyTKB.symbol();

  for (const wallet of MINT_WALLETS) {
    const short = `${wallet.slice(0,6)}...${wallet.slice(-4)}`;
    info(`Minting to ${short}:`);

    let tx;
    tx = await ethTKA.mint(wallet, MINT_AMOUNT);  await tx.wait();
    tx = await ethTKB.mint(wallet, MINT_AMOUNT);  await tx.wait();
    tx = await polyTKA.mint(wallet, MINT_AMOUNT); await tx.wait();
    tx = await polyTKB.mint(wallet, MINT_AMOUNT); await tx.wait();

    console.log(`  ✅ 10,000 ${ethSymA}  on ETH (${ethInfo.contracts.TestTokenA})`);
    console.log(`  ✅ 10,000 ${ethSymB}  on ETH (${ethInfo.contracts.TestTokenB})`);
    console.log(`  ✅ 10,000 ${polySymA} on Polygon (${polyInfo.contracts.TestTokenA})`);
    console.log(`  ✅ 10,000 ${polySymB} on Polygon (${polyInfo.contracts.TestTokenB})`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n=============================================");
  console.log("  Setup complete!");
  console.log("=============================================");
  console.log("\nLocal ETH contracts:");
  console.log("  CrossChainOrderBook:", ethInfo.contracts.CrossChainOrderBook);
  console.log("  HTLC:               ", ethInfo.contracts.HTLC);
  console.log("  TKA:                ", ethInfo.contracts.TestTokenA);
  console.log("  TKB:                ", ethInfo.contracts.TestTokenB);
  console.log("\nLocal Polygon contracts:");
  console.log("  CrossChainOrderBook:", polyInfo.contracts.CrossChainOrderBook);
  console.log("  HTLC:               ", polyInfo.contracts.HTLC);
  console.log("  pTKA:               ", polyInfo.contracts.TestTokenA);
  console.log("  pTKB:               ", polyInfo.contracts.TestTokenB);
  console.log("\nNext: node scripts/generate-local-env.js && restart frontend\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
