#!/bin/bash
# =============================================================
# Deploy all contracts to local blockchain nodes
# Run AFTER: docker compose -f docker-compose.local.yml up -d
# =============================================================

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ETH_DIR="$ROOT/ethereum"
POLYGON_DIR="$ROOT/polygon"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ----------------------------------------------------------
# Wait for Anvil node to be ready
# ----------------------------------------------------------
wait_for_node() {
  local url="$1"
  local name="$2"
  local max=30

  info "Waiting for $name at $url ..."
  for i in $(seq 1 $max); do
    if curl -sf -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        "$url" > /dev/null 2>&1; then
      info "$name is ready"
      return 0
    fi
    sleep 2
    echo -n "."
  done
  error "$name did not become ready in time"
}

# ----------------------------------------------------------
# Step 1 — Deploy Ethereum contracts (localEth, port 8545)
# ----------------------------------------------------------
deploy_ethereum() {
  info "=== Deploying Ethereum contracts to localEth (chainId 31337) ==="
  cd "$ETH_DIR"

  npx hardhat run scripts/deploy.js --network localEth
  npx hardhat run scripts/deploy-htlc.js --network localEth

  info "Ethereum deployment-info.json saved at $ETH_DIR/deployment-info.json"
}

# ----------------------------------------------------------
# Step 2 — Deploy Polygon contracts (localPolygon, port 8546)
# ----------------------------------------------------------
deploy_polygon() {
  info "=== Deploying Polygon contracts to localPolygon (chainId 31338) ==="
  cd "$POLYGON_DIR"

  npx hardhat run scripts/deploy.js --network localPolygon

  info "Polygon deployment-info.json saved at $POLYGON_DIR/deployment-info.json"
}

# ----------------------------------------------------------
# Step 3 — Generate frontend .env.local
# ----------------------------------------------------------
generate_env() {
  info "=== Generating frontend/.env.local ==="
  cd "$ROOT"
  node scripts/generate-local-env.js
}

# =============================================================
# Main
# =============================================================
echo ""
echo "============================================="
echo "  Multi-Chain DEX — Local Deploy"
echo "============================================="
echo ""

wait_for_node "http://127.0.0.1:8545" "Anvil ETH"
wait_for_node "http://127.0.0.1:8546" "Anvil Polygon"

deploy_ethereum
deploy_polygon
generate_env

echo ""
echo "============================================="
echo "  Deploy complete!"
echo "  Now start the frontend: cd frontend && npm run dev"
echo "============================================="
echo ""
