# CLOB Mobile MVP Implementation Plan

## Overview
Build a functional CLOB trading app with:
1. Sign Up (delegation + token minting)
2. Trading (deposit, place orders, withdraw)
3. Portfolio (view balances and positions)

## Architecture
```
App.tsx
├── OnboardingScreen (Sign Up)
│   ├── Create/Import Wallet
│   ├── Setup Porto Delegation
│   └── Mint Test Tokens
├── TradingScreen (Trade)
│   ├── Deposit to CLOB
│   ├── Place Buy/Sell Orders
│   └── View Order Book
└── PortfolioScreen (Portfolio)
    ├── View Wallet Balances
    ├── View CLOB Balances
    └── Withdraw from CLOB
```

## Implementation Steps

### Phase 1: Contract Hooks (useUnifiedCLOB.ts)
Based on our working tests in `/tests`, implement:

```typescript
// Token Operations
mintTokens(token: Address, amount: bigint)
approveToken(token: Address, spender: Address, amount: bigint)
depositToCLOB(token: Address, amount: bigint)
withdrawFromCLOB(token: Address, amount: bigint)

// Trading Operations
placeOrder(bookId: number, orderType: number, price: bigint, amount: bigint)
cancelOrder(bookId: number, orderId: bigint)
matchOrders(bookId: number)

// View Functions
getBalance(user: Address, token: Address): bigint
getCLOBBalance(user: Address, token: Address): bigint
getOrderBook(bookId: number): Order[]
```

### Phase 2: Sign Up Flow (OnboardingScreen)

1. **Welcome Screen**
   - "Create New Wallet" or "Import Existing"
   - Store private key in SecureStore

2. **Delegation Setup**
   - Call `setupDelegation()` from Porto provider
   - Show progress indicator
   - Handle success/failure

3. **Token Minting**
   - Mint 10,000 USDC
   - Mint 10 WETH
   - Mint 1 WBTC
   - Show transaction status

4. **Complete**
   - Navigate to Trading screen

### Phase 3: Trading Screen

1. **Deposit Modal**
   - Select token (USDC, WETH, WBTC)
   - Enter amount
   - Approve token (if needed)
   - Deposit to CLOB
   - Show transaction status

2. **Order Placement**
   - Select trading pair
   - Enter price and amount
   - Calculate total with fees
   - Place order via Porto relay
   - Show confirmation

3. **Order Book**
   - Display buy/sell orders
   - Show spread
   - Manual match button

### Phase 4: Portfolio Screen

1. **Balance Display**
   - Wallet balances (from blockchain)
   - CLOB balances (from contract)
   - Total USD value (hardcoded prices)

2. **Withdraw Function**
   - Select token
   - Enter amount
   - Execute withdrawal
   - Update balances

### Phase 5: Hardcoded Prices

```typescript
const HARDCODED_PRICES = {
  WETH: 2500,  // $2,500 per ETH
  WBTC: 65000, // $65,000 per BTC
  USDC: 1,     // $1 per USDC
};
```

## Contract Addresses & Functions

### UnifiedCLOBV2 (0x92025983Ab5641378893C3932A1a43e214e7446D)
- `deposit(address token, uint256 amount)`
- `withdraw(address token, uint256 amount)`
- `placeOrder(uint8 bookId, uint8 orderType, uint256 price, uint256 amount)`
- `cancelOrder(uint8 bookId, uint256 orderId)`
- `matchOrders(uint8 bookId)`
- `getBalance(address user, address token)`

### MintableERC20 Tokens
- USDC: 0xaE3A504B9Fe27cf2ff3Ed3e36bE037AD36a1a48a
- WETH: 0x3Af2aed9FFA29b2a0e387a2Fb45a540A66f4D2b4
- WBTC: 0x30301403f92915c8731880eF595c20C8C6059369

Functions:
- `mint(address to, uint256 amount)`
- `approve(address spender, uint256 amount)`
- `balanceOf(address account)`

## Testing Strategy

1. **Unit Tests**
   - Test each contract function
   - Test Porto relay integration
   - Test decimal conversions

2. **Integration Tests**  
   - Complete onboarding flow
   - Place and cancel orders
   - Deposit and withdraw

3. **Manual Testing**
   - Test on Android emulator
   - Verify gasless transactions
   - Check balance updates

## Success Metrics

- [ ] User can create wallet and setup delegation
- [ ] User can mint test tokens
- [ ] User can deposit tokens to CLOB
- [ ] User can place buy/sell orders
- [ ] User can view order book
- [ ] User can withdraw tokens
- [ ] All transactions are gasless via Porto
- [ ] Portfolio shows correct balances
- [ ] USD values calculated correctly

## Next Steps After MVP

1. Real-time WebSocket updates
2. Historical data from indexer
3. Price charts
4. Order history
5. Advanced order types
6. Production deployment