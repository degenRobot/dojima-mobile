# Dojima Mobile - Development Roadmap

## Executive Summary
Dojima Mobile is a decentralized trading platform on RISE blockchain with gasless transactions via Porto Protocol. The core infrastructure is complete with UnifiedCLOBV2 contract deployed, mobile app functional, and market orders implemented.

**Current Status**: MVP functional, ready for enhanced features and production preparation.

---

## ✅ Completed (Summary)

### Infrastructure & Contracts
- **UnifiedCLOBV2 Contract** deployed at `0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C`
  - Limit orders with price-time priority
  - Market orders with slippage protection
  - Virtual vault for gas-efficient matching
  - Manual order matching for limit orders

### Mobile Application  
- **React Native app** with Expo SDK 51
- **Porto Protocol integration** for gasless transactions
- **Account delegation** setup flow (`/mobile/src/screens/SetupScreen.tsx`)
- **Trading interface** with market order support (`/mobile/src/components/trading/OrderForm.tsx`)
- **Portfolio tracking** hooks (`/mobile/src/hooks/usePortfolio.ts`)

### Testing Suite
- Comprehensive test coverage in `/tests/`
- Porto relay integration tests
- Market order functionality tests

---

## 🚧 Current Sprint (Immediate Priority)

### 1. Testing & Verification ⚡ PRIORITY
**Goal**: Ensure all features work end-to-end

#### Tasks:
- [ ] Run full test suite and fix any failures
  ```bash
  cd tests
  node test-complete-mobile-flow.js  # Full integration test
  node test-market-orders.js         # Market order testing
  ```
- [ ] Test mobile app flow with new contracts
  ```bash
  cd mobile && npm start
  # Test: Setup → Mint → Deposit → Trade (both limit & market)
  ```
- [ ] Verify Porto relay connectivity
  - Check delegation at `https://rise-testnet-porto.fly.dev`
  - Monitor gasless transaction execution

#### Files to Update:
- `/tests/test-complete-mobile-flow.js` - Ensure addresses match latest deployment
- `/mobile/src/config/contracts.ts` - Verify all addresses are current

---

## 📋 Short Term (Next 2 Weeks)

### 2. Portfolio Screen Enhancement
**Goal**: Display real balances and transaction history

#### Implementation Tasks:
- [ ] Integrate `usePortfolio` hook in `/mobile/src/screens/PortfolioScreen.tsx`
  ```typescript
  // Add to PortfolioScreen.tsx
  import { usePortfolio } from '../hooks/usePortfolio';
  
  const { portfolio, loading, refreshing, refresh } = usePortfolio();
  ```
- [ ] Display wallet vs CLOB balances
- [ ] Show locked amounts in orders
- [ ] Add pull-to-refresh functionality
- [ ] Calculate total portfolio value in USD

#### UI Components Needed:
- [ ] Balance card component showing available/locked
- [ ] Transaction history list
- [ ] Portfolio chart (optional)

### 3. Real Order Book Implementation
**Goal**: Display live order book from contract

#### Tasks:
- [ ] Create order book fetching in `/mobile/src/hooks/useOrderBook.ts`
  ```typescript
  // Fetch orders from contract
  const fetchOrderBook = async (bookId: number) => {
    const buyOrders = await readContract('getBuyOrders', [bookId]);
    const sellOrders = await readContract('getSellOrders', [bookId]);
    return { buyOrders, sellOrders };
  };
  ```
- [ ] Build order book UI component
- [ ] Implement depth chart visualization
- [ ] Highlight user's own orders
- [ ] Add auto-refresh on new blocks

#### Files to Create/Update:
- `/mobile/src/hooks/useOrderBook.ts` - Order book fetching logic
- `/mobile/src/components/trading/OrderBook.tsx` - UI component
- `/mobile/src/screens/MarketsScreen.tsx` - Replace mock with real data

### 4. Indexing Integration with Ponder
**Goal**: Connect GraphQL API for historical data

#### Setup Steps:
1. **Update Ponder Configuration** (`/indexing/ponder.config.ts`):
   ```typescript
   UnifiedCLOBV2: {
     chain: "rise",
     abi: unifiedCLOBV2ABI,
     address: "0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C", // Update to new address
     startBlock: 18000000,
   }
   ```

2. **Add Event Handlers** (`/indexing/src/UnifiedCLOBV2.ts`):
   ```typescript
   // Handle OrderPlaced events
   ponder.on("UnifiedCLOBV2:OrderPlaced", async ({ event, context }) => {
     // Store order data
   });
   
   // Handle MarketOrderExecuted events (NEW)
   ponder.on("UnifiedCLOBV2:MarketOrderExecuted", async ({ event, context }) => {
     // Track market order execution
   });
   ```

3. **Update Schema** (`/indexing/ponder.schema.ts`):
   - Add MarketOrder entity
   - Add slippage tracking fields
   - Update Trade entity for market orders

#### Running the Stack:
```bash
# Terminal 1: Start Indexer
cd indexing
npm install
npm run dev  # Runs on http://localhost:42069

# Terminal 2: Start Mobile App
cd mobile
npm start

# Terminal 3: (Optional) Run tests
cd tests
node test-complete-mobile-flow.js
```

#### Mobile App Integration:
- [ ] Add GraphQL client to mobile app
- [ ] Create hooks for historical data
- [ ] Display trade history in Portfolio screen

---

## 📋 Medium Term (1 Month)

### 5. WebSocket Real-time Updates
**Goal**: Replace polling with WebSocket subscriptions

#### Implementation:
- [ ] Create WebSocket manager in `/mobile/src/lib/websocket/`
  ```typescript
  // Connect to RISE WebSocket
  const ws = new WebSocket('wss://testnet.riselabs.xyz/ws');
  
  // Subscribe to contract events
  ws.send(JSON.stringify({
    method: 'rise_subscribe',
    params: ['logs', { address: CLOB_ADDRESS }]
  }));
  ```
- [ ] Replace polling in `usePortfolio` hook
- [ ] Add real-time order book updates
- [ ] Implement trade notifications

### 6. Advanced Order Types
**Goal**: Implement stop-loss and take-profit orders

#### Contract Updates Needed:
- [ ] Add conditional order support to UnifiedCLOBV2
- [ ] Implement order modification functions
- [ ] Add batch order placement

#### Mobile Updates:
- [ ] Update OrderForm for advanced order types
- [ ] Add order management screen
- [ ] Create order templates feature

### 7. Charts & Analytics
**Goal**: Add trading charts and analytics

#### Components:
- [ ] Integrate charting library (react-native-svg-charts)
- [ ] Price chart with candlesticks
- [ ] Volume indicators
- [ ] Depth chart
- [ ] P&L tracking

---

## 📋 Long Term (3+ Months)

### 8. Production Preparation
**Goal**: Prepare for mainnet launch

#### Security:
- [ ] Smart contract audit
- [ ] Penetration testing
- [ ] Rate limiting implementation
- [ ] Biometric authentication in app

#### Infrastructure:
- [ ] Multi-region Porto relay deployment
- [ ] Load balancing setup
- [ ] Database redundancy
- [ ] Monitoring and alerting

#### Legal & Compliance:
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] KYC/AML integration (if required)
- [ ] Jurisdiction compliance

### 9. Mobile App Release
**Goal**: Launch on App Store and Google Play

#### Tasks:
- [ ] App Store optimization (ASO)
- [ ] Screenshots and app preview
- [ ] Beta testing via TestFlight/Play Console
- [ ] App review preparation
- [ ] Marketing materials

---

## 🐛 Known Issues & Fixes

### High Priority:
1. **Order Matching Automation**
   - Current: Manual trigger required for limit orders
   - Solution: Implement keeper bot or incentivized matching
   - File: Create `/bots/matcher-bot.js`

2. **Price Discovery**
   - Current: Hardcoded prices ($2500 WETH, $65000 WBTC)
   - Solution: Integrate price oracle or use last trade price
   - File: Update `/mobile/src/hooks/useCLOBContract.ts`

3. **WebSocket Provider**
   - Current: Mock implementation
   - Solution: Connect to real RISE WebSocket
   - File: Update `/mobile/src/providers/WebSocketProvider.tsx`

### Medium Priority:
- [ ] Add error boundaries to React components
- [ ] Implement retry logic for failed transactions
- [ ] Add transaction history caching
- [ ] Optimize bundle size with code splitting

---

## 🔧 Development Setup

### Prerequisites:
```bash
# Install dependencies
Node.js 18+
Foundry (for contracts)
Expo CLI
PostgreSQL (for Ponder indexer)
```

### Environment Variables:
```bash
# .env in /mobile
EXPO_PUBLIC_RPC_URL=https://testnet.riselabs.xyz
EXPO_PUBLIC_PORTO_RELAY=https://rise-testnet-porto.fly.dev
EXPO_PUBLIC_CHAIN_ID=11155931

# .env in /indexing
PONDER_RPC_URL_1=https://testnet.riselabs.xyz
DATABASE_URL=postgresql://user:pass@localhost:5432/dojima
```

### Running Everything:
```bash
# 1. Deploy/verify contracts (if needed)
cd contracts
forge script script/DeployUnifiedCLOBV2.s.sol --rpc-url https://testnet.riselabs.xyz --broadcast

# 2. Start indexer (required for historical data)
cd indexing
npm install
npm run dev  # http://localhost:42069

# 3. Start mobile app
cd mobile
npm install
npm start  # Expo DevTools will open

# 4. Run tests
cd tests
npm install
node test-complete-mobile-flow.js
```

---

## 📊 Success Metrics

### MVP Metrics (Current):
- ✅ Gasless transactions working
- ✅ Order placement functional
- ✅ Market orders with slippage protection
- ✅ Account delegation setup

### Production Metrics (Target):
- [ ] < 1s order placement time
- [ ] < 500ms balance updates
- [ ] 99.9% uptime
- [ ] < 0.1% slippage on market orders
- [ ] Zero gas costs for users

---

## 📚 Key Resources

### Documentation:
- Porto Protocol: https://porto.sh
- RISE Chain: https://docs.risechain.com
- Ponder: https://ponder.sh/docs

### Contract Addresses (Latest):
```
UnifiedCLOBV2: 0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C
USDC: 0xC23b6B892c947746984474d52BBDF4ADd25717B3
WETH: 0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4
WBTC: 0x7C4B1b2953Fd3bB0A4aC07da70b0839d1D09c2cA
Porto Delegation: 0x894C14A66508D221A219Dd0064b4A6718d0AAA52
```

### Support Channels:
- GitHub Issues: [Project Repository]
- Discord: [RISE Community]
- Porto Support: support@porto.sh

---

Last Updated: November 2024
Version: 0.3.0-alpha