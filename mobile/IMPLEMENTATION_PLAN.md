# CLOB Mobile Implementation Plan

## Current Status
✅ App loads successfully
✅ Porto relay integration copied from working example
✅ SimplePortoProvider created with delegation flow
❌ WebSocket real-time updates (using mock)
❌ Indexing integration
❌ Actual CLOB contract interactions

## Architecture Overview

### 1. Porto Relay (Gasless Transactions)
- **File**: `src/lib/porto/simple-porto.ts`
- **Based on**: Working rise-mobile-example
- **Features**:
  - EIP-7702 delegation setup
  - Gasless transaction sending
  - Account management
  - Transaction status tracking

### 2. Provider Structure
```
App.tsx
├── SimplePortoProvider (Real - handles delegation & transactions)
│   └── Uses simple-porto.ts functions
└── MockWebSocketProvider (Temporary - will be replaced)
    └── Returns empty data for now
```

### 3. Contract Integration

#### UnifiedCLOBV2 Functions to Implement:
```typescript
// 1. Token Operations
- approve(token, amount)
- deposit(token, amount)
- withdraw(token, amount)

// 2. Trading Operations
- placeOrder(bookId, orderType, price, amount)
- cancelOrder(bookId, orderId)
- matchOrders(bookId)

// 3. View Functions (no gas)
- getBalance(user, token)
- getOrder(bookId, orderId)
- getOrderBook(bookId, depth)
```

## Implementation Steps

### Phase 1: Core Trading Flow (CURRENT)
1. ✅ Fix provider initialization
2. ✅ Setup Porto delegation
3. ⏳ Test wallet creation and delegation
4. ⏳ Implement token approval flow
5. ⏳ Implement deposit/withdraw
6. ⏳ Implement order placement

### Phase 2: Real-time Updates
1. Replace MockWebSocketProvider with real implementation
2. Connect to RISE WebSocket endpoint
3. Subscribe to UnifiedCLOB events
4. Update UI with real-time order book changes

### Phase 3: Indexing Integration
1. Connect to Ponder GraphQL endpoint
2. Fetch historical orders
3. Fetch user balances
4. Display trade history

## Testing Checklist

### 1. Porto Relay
- [ ] Account creation
- [ ] Delegation setup
- [ ] First gasless transaction
- [ ] Transaction status tracking

### 2. CLOB Operations
- [ ] Token approval
- [ ] Deposit USDC/WETH
- [ ] Place buy order
- [ ] Place sell order
- [ ] Cancel order
- [ ] Manual order matching
- [ ] Withdraw funds

### 3. UI/UX
- [ ] Trading screen loads
- [ ] Portfolio displays balances
- [ ] Order book shows orders
- [ ] Recent trades display

## Key Files

### Core Implementation
- `src/lib/porto/simple-porto.ts` - Porto relay functions
- `src/providers/SimplePortoProvider.tsx` - Porto context provider
- `src/hooks/useUnifiedCLOB.ts` - CLOB contract interactions

### Screens
- `src/screens/TradingScreen.tsx` - Main trading interface
- `src/screens/PortfolioScreen.tsx` - Balance management
- `src/screens/MarketsScreen.tsx` - Order book view

### Configuration
- `src/config/contracts.ts` - Contract addresses and ABIs
- `src/config/viemClient.ts` - Blockchain client setup

## Environment Variables Needed
```env
EXPO_PUBLIC_PORTO_RELAY_URL=https://rise-testnet-porto.fly.dev
EXPO_PUBLIC_RPC_URL=https://indexing.testnet.riselabs.xyz
EXPO_PUBLIC_WS_URL=wss://testnet.riselabs.xyz/ws
EXPO_PUBLIC_PONDER_URL=http://localhost:42069
```

## Next Immediate Actions

1. **Test Current Setup**
   - Reload app in emulator
   - Check console for Porto connection
   - Verify account creation

2. **Implement First Transaction**
   - Create a simple test transaction
   - Use Settings screen for testing
   - Verify gasless execution

3. **Add CLOB Functions**
   - Start with view functions (no gas)
   - Then implement deposit/withdraw
   - Finally add trading functions

## Common Issues & Solutions

### Issue: TextDecoder not defined
**Solution**: Added fast-text-encoding polyfill in polyfills.ts

### Issue: Contract addresses undefined
**Solution**: Updated references from EnhancedSpotBook to UnifiedCLOB

### Issue: Porto relay errors
**Solution**: Using exact implementation from working example

### Issue: WebSocket connection fails
**Solution**: Using mock provider temporarily

## Resources
- [Porto Documentation](https://rise-testnet-porto.fly.dev)
- [RISE Testnet Explorer](https://testnet-explorer.riselabs.xyz)
- [UnifiedCLOBV2 Contract](https://testnet-explorer.riselabs.xyz/address/0x92025983Ab5641378893C3932A1a43e214e7446D)
- [Working Example](../external/rise-mobile-example)