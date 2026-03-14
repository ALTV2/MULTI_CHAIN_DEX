#!/usr/bin/env node
/**
 * Reads deployment-info.json from ethereum/ and polygon/ (and sui/)
 * and writes the contract addresses into frontend/.env.local
 *
 * Run automatically at the end of scripts/deploy-local.sh,
 * or manually: node scripts/generate-local-env.js
 */

const fs   = require("fs");
const path = require("path");

const ROOT         = path.resolve(__dirname, "..");
const ETH_INFO     = path.join(ROOT, "ethereum",  "deployment-info.json");
const POLYGON_INFO = path.join(ROOT, "polygon",   "deployment-info.json");
const SUI_INFO     = path.join(ROOT, "sui",        "deployment-info.json");
const ENV_OUT      = path.join(ROOT, "frontend",   ".env.local");

// ─── helpers ──────────────────────────────────────────────────────────────────
function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] Not found: ${filePath} — skipping`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCurrentEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const map = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function mergeAndWrite(envPath, updates) {
  const current = readCurrentEnv(envPath);
  const merged  = { ...current, ...updates };

  // Preserve all comment-blocks and blank lines from the original,
  // then append / overwrite only the keys we touched.
  let existingContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";

  // For each key we're updating, replace or append
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(existingContent)) {
      existingContent = existingContent.replace(re, `${key}=${value}`);
    } else {
      existingContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, existingContent);
}

// ─── main ─────────────────────────────────────────────────────────────────────
console.log("\n[generate-local-env] Reading deployment info...\n");

const ethInfo  = readJson(ETH_INFO);
const polyInfo = readJson(POLYGON_INFO);
const suiInfo  = readJson(SUI_INFO);

const updates = {
  // Switch frontend to local mode
  NEXT_PUBLIC_CHAIN_MODE: "local",

  // RPC URLs — EVM local, SUI stays on testnet (arm64 docker incompatibility)
  NEXT_PUBLIC_LOCAL_ETH_RPC_URL:     "http://127.0.0.1:8545",
  NEXT_PUBLIC_LOCAL_POLYGON_RPC_URL: "http://127.0.0.1:8546",
};

// Ethereum contract addresses
if (ethInfo?.contracts) {
  const c = ethInfo.contracts;
  if (c.TokenManager)        updates.NEXT_PUBLIC_LOCAL_ETH_TOKEN_MANAGER          = c.TokenManager;
  if (c.OrderBook)           updates.NEXT_PUBLIC_LOCAL_ETH_ORDER_BOOK             = c.OrderBook;
  if (c.Trade)               updates.NEXT_PUBLIC_LOCAL_ETH_TRADE                  = c.Trade;
  if (c.HTLC)                updates.NEXT_PUBLIC_LOCAL_ETH_HTLC                   = c.HTLC;
  if (c.CrossChainOrderBook) updates.NEXT_PUBLIC_LOCAL_ETH_CROSS_CHAIN_ORDER_BOOK = c.CrossChainOrderBook;
  if (c.TestTokenA)          updates.NEXT_PUBLIC_LOCAL_ETH_TEST_TOKEN_A           = c.TestTokenA;
  if (c.TestTokenB)          updates.NEXT_PUBLIC_LOCAL_ETH_TEST_TOKEN_B           = c.TestTokenB;
  console.log("  [ETH]     contracts loaded from", ETH_INFO);
}

// Polygon contract addresses
if (polyInfo?.contracts) {
  const c = polyInfo.contracts;
  if (c.TokenManager)        updates.NEXT_PUBLIC_LOCAL_POLYGON_TOKEN_MANAGER          = c.TokenManager;
  if (c.OrderBook)           updates.NEXT_PUBLIC_LOCAL_POLYGON_ORDER_BOOK             = c.OrderBook;
  if (c.Trade)               updates.NEXT_PUBLIC_LOCAL_POLYGON_TRADE                  = c.Trade;
  if (c.HTLC)                updates.NEXT_PUBLIC_LOCAL_POLYGON_HTLC                   = c.HTLC;
  if (c.CrossChainOrderBook) updates.NEXT_PUBLIC_LOCAL_POLYGON_CROSS_CHAIN_ORDER_BOOK = c.CrossChainOrderBook;
  if (c.TestTokenA)          updates.NEXT_PUBLIC_LOCAL_POLYGON_TEST_TOKEN_A           = c.TestTokenA;
  if (c.TestTokenB)          updates.NEXT_PUBLIC_LOCAL_POLYGON_TEST_TOKEN_B           = c.TestTokenB;
  console.log("  [POLYGON] contracts loaded from", POLYGON_INFO);
}

// SUI package addresses
if (suiInfo?.packageId) {
  updates.NEXT_PUBLIC_LOCAL_SUI_PACKAGE_ID = suiInfo.packageId;
  if (suiInfo.orderBookObjectId)
    updates.NEXT_PUBLIC_LOCAL_SUI_ORDER_BOOK_OBJECT_ID = suiInfo.orderBookObjectId;
  console.log("  [SUI]     package loaded from", SUI_INFO);
}

mergeAndWrite(ENV_OUT, updates);

console.log("\n[generate-local-env] Written to", ENV_OUT);
console.log("  NEXT_PUBLIC_CHAIN_MODE =", updates.NEXT_PUBLIC_CHAIN_MODE);
console.log("\n  Restart 'npm run dev' to pick up the new addresses.\n");
