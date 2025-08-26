# CLOB Integration Tests

This directory contains Playwright tests for the CLOB system, testing the integration between:
- Blockchain events (via WebSocket)
- Ponder indexer (GraphQL API)
- Frontend UI (Next.js)

## Setup

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Fund Test Wallet

The tests use an embedded wallet that needs ETH and tokens:

```bash
# Set your funding wallet private key
export PRIVATE_KEY="your-wallet-with-eth-and-tokens"

# Run the funding script
./scripts/fund-test-wallet.sh
```

Test wallet details:
- Private Key: `0x99e8065d93229e87953669c23cc193f4bbebcdbb877ed272c66ee27a5cb75508`
- Address: `0xdD870fA1b7C4700F2BD7f44238821C26f7392148`

### 3. Start Services

The tests need both the indexer and frontend running:

```bash
# Terminal 1: Start indexer
cd indexing
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Basic Tests Only
```bash
npx playwright test clob-basic.spec.ts
```

### Run Full Integration Tests
```bash
npx playwright test clob-integration.spec.ts
```

### Run with UI Mode
```bash
npx playwright test --ui
```

### Run Specific Test
```bash
npx playwright test -g "should connect embedded wallet"
```

## Test Scenarios

### Basic Tests (`clob-basic.spec.ts`)
- WebSocket connection and event streaming
- GraphQL API queries
- Order book loading
- Embedded wallet connection

### Integration Tests (`clob-integration.spec.ts`)
- Full deposit → order → cancel flow
- Real-time updates across multiple tabs
- Event propagation from blockchain → indexer → UI
- GraphQL data consistency

## Debugging

### View Test Report
```bash
npx playwright show-report
```

### Run in Debug Mode
```bash
npx playwright test --debug
```

### Check Service Status
```bash
# Check indexer
curl http://localhost:42069/graphql

# Check frontend
curl http://localhost:3000
```

### Common Issues

1. **Services not running**: Make sure both indexer and frontend are running
2. **Wallet not funded**: Run the funding script with a funded wallet
3. **WebSocket connection fails**: Check RISE testnet RPC is accessible
4. **GraphQL queries fail**: Ensure indexer is synced (check Ponder logs)

## Manual Testing Steps

If automated tests fail, you can manually verify:

1. **Check WebSocket Events**
   - Go to http://localhost:3000/events
   - Should show "Connected" with green dot
   - Select "EnhancedSpotBook" from dropdown
   - Events should appear when orders are placed

2. **Check GraphQL API**
   ```bash
   curl -X POST http://localhost:42069/graphql \
     -H "Content-Type: application/json" \
     -d '{"query": "{ markets { items { address name } } }"}'
   ```

3. **Check Order Book Updates**
   - Go to http://localhost:3000/trade/WETH-USDC
   - Order book should load (or show "No orders")
   - Place an order and see it appear
   - Cancel order and see it disappear

4. **Check Real-time Updates**
   - Open two browser windows on trading page
   - Place order in one window
   - Should appear in other window within 2-3 seconds