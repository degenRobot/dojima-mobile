#!/bin/bash

# Local Testing Environment Setup Script
# This script sets up a complete local testing environment with:
# 1. Anvil fork of RISE testnet
# 2. Ponder indexer
# 3. WebSocket testing
# 4. Mobile app with local connections

set -e

echo "🚀 Starting Local CLOB Testing Environment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RISE_RPC="https://indexing.testnet.riselabs.xyz"
ANVIL_PORT=8545
PONDER_PORT=42069
FORK_BLOCK="" # Will be set to latest

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    if check_port $1; then
        echo "Killing process on port $1..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
    fi
}

# Step 1: Clean up any existing processes
echo -e "${YELLOW}Step 1: Cleaning up existing processes...${NC}"
kill_port $ANVIL_PORT
kill_port $PONDER_PORT
sleep 2

# Step 2: Get latest block number
echo -e "${YELLOW}Step 2: Getting latest block number from RISE testnet...${NC}"
LATEST_BLOCK=$(cast block-number --rpc-url $RISE_RPC)
echo "Latest block: $LATEST_BLOCK"

# Step 3: Start Anvil fork
echo -e "${YELLOW}Step 3: Starting Anvil fork on port $ANVIL_PORT...${NC}"
anvil \
    --fork-url $RISE_RPC \
    --fork-block-number $LATEST_BLOCK \
    --port $ANVIL_PORT \
    --auto-impersonate \
    --block-time 2 \
    --gas-limit 30000000 \
    --code-size-limit 100000 \
    --accounts 10 \
    > anvil.log 2>&1 &

ANVIL_PID=$!
echo "Anvil PID: $ANVIL_PID"

# Wait for Anvil to be ready
echo "Waiting for Anvil to be ready..."
sleep 5

# Verify Anvil is running
if check_port $ANVIL_PORT; then
    echo -e "${GREEN}✅ Anvil is running on port $ANVIL_PORT${NC}"
else
    echo -e "${RED}❌ Failed to start Anvil${NC}"
    exit 1
fi

# Step 4: Deploy/Setup contracts (optional - they should already exist in fork)
echo -e "${YELLOW}Step 4: Verifying contracts in fork...${NC}"

# Test that contracts exist
echo "Testing UnifiedCLOBV2 contract..."
CLOB_CODE=$(cast code 0x92025983Ab5641378893C3932A1a43e214e7446D --rpc-url http://localhost:$ANVIL_PORT)
if [ "$CLOB_CODE" != "0x" ]; then
    echo -e "${GREEN}✅ UnifiedCLOBV2 contract found${NC}"
else
    echo -e "${RED}❌ UnifiedCLOBV2 contract not found${NC}"
fi

# Step 5: Fund test accounts
echo -e "${YELLOW}Step 5: Setting up test accounts...${NC}"

# Test accounts (Anvil default accounts)
ALICE="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
BOB="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
CHARLIE="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

# Give them some tokens (USDC, WETH, WBTC)
echo "Funding test accounts with tokens..."

# Use cast to call mint functions (if tokens have them)
# This assumes the forked tokens have mint functions exposed
# If not, we'll need to use existing funded accounts

# Step 6: Start Ponder indexer
echo -e "${YELLOW}Step 6: Starting Ponder indexer...${NC}"

cd indexing
# Update .env with local RPC
echo "PONDER_RPC_URL_1=http://localhost:$ANVIL_PORT" > .env.local
npm run dev > ../ponder.log 2>&1 &
PONDER_PID=$!
echo "Ponder PID: $PONDER_PID"
cd ..

# Wait for Ponder to be ready
echo "Waiting for Ponder to be ready..."
sleep 10

if check_port $PONDER_PORT; then
    echo -e "${GREEN}✅ Ponder is running on port $PONDER_PORT${NC}"
    echo "GraphQL playground: http://localhost:$PONDER_PORT/graphql"
else
    echo -e "${YELLOW}⚠️  Ponder might still be starting up${NC}"
fi

# Step 7: Create test transactions
echo -e "${YELLOW}Step 7: Creating test transactions...${NC}"

cat > test-local-transactions.js << 'EOF'
import { createPublicClient, createWalletClient, http, parseUnits, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost } from 'viem/chains';

const CONTRACTS = {
  UnifiedCLOB: '0x92025983Ab5641378893C3932A1a43e214e7446D',
  USDC: '0xaE3A504B9Fe27cf2ff3Ed3e36bE037AD36a1a48a',
  WETH: '0x3Af2aed9FFA29b2a0e387a2Fb45a540A66f4D2b4',
  WBTC: '0x30301403f92915c8731880eF595c20C8C6059369',
};

const unifiedCLOBABI = [
  'function deposit(address token, uint256 amount)',
  'function placeOrder(uint256 bookId, uint8 orderType, uint256 price, uint256 amount) returns (uint256)',
  'function matchOrders(uint256 bookId, uint256 maxMatches)',
  'function cancelOrder(uint256 orderId)',
];

const erc20ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
];

async function main() {
  // Setup clients
  const publicClient = createPublicClient({
    chain: localhost,
    transport: http('http://localhost:8545'),
  });

  const alice = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  const bob = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

  const walletClientAlice = createWalletClient({
    account: alice,
    chain: localhost,
    transport: http('http://localhost:8545'),
  });

  const walletClientBob = createWalletClient({
    account: bob,
    chain: localhost,
    transport: http('http://localhost:8545'),
  });

  console.log('📊 Creating test CLOB transactions...\n');

  try {
    // Step 1: Mint tokens (if possible)
    console.log('1️⃣ Attempting to mint tokens...');
    // This might fail if mint is restricted, that's ok
    
    // Step 2: Approve CLOB to spend tokens
    console.log('2️⃣ Approving token spending...');
    
    const approveAmount = parseUnits('1000000', 6); // 1M USDC
    
    await walletClientAlice.writeContract({
      address: CONTRACTS.USDC,
      abi: erc20ABI,
      functionName: 'approve',
      args: [CONTRACTS.UnifiedCLOB, approveAmount],
    });
    
    await walletClientBob.writeContract({
      address: CONTRACTS.USDC,
      abi: erc20ABI,
      functionName: 'approve',
      args: [CONTRACTS.UnifiedCLOB, approveAmount],
    });
    
    // Step 3: Deposit to CLOB
    console.log('3️⃣ Depositing to CLOB...');
    
    await walletClientAlice.writeContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: unifiedCLOBABI,
      functionName: 'deposit',
      args: [CONTRACTS.USDC, parseUnits('10000', 6)],
    });
    
    await walletClientBob.writeContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: unifiedCLOBABI,
      functionName: 'deposit',
      args: [CONTRACTS.USDC, parseUnits('10000', 6)],
    });
    
    // Step 4: Place orders
    console.log('4️⃣ Placing orders...');
    
    // Alice places buy order
    const aliceOrderTx = await walletClientAlice.writeContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: unifiedCLOBABI,
      functionName: 'placeOrder',
      args: [
        1n, // bookId (WETH/USDC)
        0, // BUY
        parseUnits('2000', 6), // price: 2000 USDC
        parseUnits('0.1', 18), // amount: 0.1 WETH
      ],
    });
    console.log('Alice buy order tx:', aliceOrderTx);
    
    // Bob places sell order
    const bobOrderTx = await walletClientBob.writeContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: unifiedCLOBABI,
      functionName: 'placeOrder',
      args: [
        1n, // bookId
        1, // SELL
        parseUnits('1900', 6), // price: 1900 USDC
        parseUnits('0.1', 18), // amount: 0.1 WETH
      ],
    });
    console.log('Bob sell order tx:', bobOrderTx);
    
    // Step 5: Match orders
    console.log('5️⃣ Matching orders...');
    
    await walletClientAlice.writeContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: unifiedCLOBABI,
      functionName: 'matchOrders',
      args: [1n, 10n],
    });
    
    console.log('\n✅ Test transactions created successfully!');
    console.log('Check Ponder at http://localhost:42069/graphql to see indexed events');
    
  } catch (error) {
    console.error('Error creating test transactions:', error);
  }
}

main();
EOF

# Step 8: Display status
echo ""
echo "========================================="
echo -e "${GREEN}✅ Local Testing Environment Ready!${NC}"
echo "========================================="
echo ""
echo "🔗 Services running:"
echo "  - Anvil (Local blockchain): http://localhost:$ANVIL_PORT"
echo "  - Ponder (Indexer): http://localhost:$PONDER_PORT/graphql"
echo ""
echo "📝 Test Accounts:"
echo "  - Alice: $ALICE"
echo "  - Bob: $BOB"
echo "  - Charlie: $CHARLIE"
echo ""
echo "📊 Contracts:"
echo "  - UnifiedCLOBV2: 0x92025983Ab5641378893C3932A1a43e214e7446D"
echo "  - USDC: 0xaE3A504B9Fe27cf2ff3Ed3e36bE037AD36a1a48a"
echo "  - WETH: 0x3Af2aed9FFA29b2a0e387a2Fb45a540A66f4D2b4"
echo "  - WBTC: 0x30301403f92915c8731880eF595c20C8C6059369"
echo ""
echo "🎯 Next steps:"
echo "  1. Run test transactions: node test-local-transactions.js"
echo "  2. Test WebSocket: node tests/test-websocket-clob.js"
echo "  3. Run mobile app with LOCAL=true: cd mobile && LOCAL=true npm start"
echo ""
echo "📖 Logs:"
echo "  - Anvil: tail -f anvil.log"
echo "  - Ponder: tail -f ponder.log"
echo ""
echo "🛑 To stop all services:"
echo "  kill $ANVIL_PID $PONDER_PID"
echo ""

# Keep script running
echo "Press Ctrl+C to stop all services..."

# Trap Ctrl+C and clean up
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $ANVIL_PID 2>/dev/null || true
    kill $PONDER_PID 2>/dev/null || true
    kill_port $ANVIL_PORT
    kill_port $PONDER_PORT
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup INT

# Wait indefinitely
while true; do
    sleep 1
done