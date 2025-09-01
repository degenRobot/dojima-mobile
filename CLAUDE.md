# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the **Dojima Mobile** project - a comprehensive decentralized trading platform built on RISE blockchain featuring:
- On-chain Central Limit Order Book (UnifiedCLOBV2)
- Gasless trading via Porto Protocol (EIP-7702)
- Mobile-first React Native application
- Market orders with slippage protection
- One-click onboarding with automatic token minting

## Network Configuration

### RISE Testnet
```
Network Name: RISE Testnet
Chain ID: 11155931
RPC URL: https://testnet.riselabs.xyz
WebSocket: wss://testnet.riselabs.xyz/ws
Explorer: https://explorer.testnet.riselabs.xyz
Porto Relay: https://rise-testnet-porto.fly.dev
```

### Current Deployment (Latest)
```
UnifiedCLOBV2: 0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C
USDC Token: 0xC23b6B892c947746984474d52BBDF4ADd25717B3
WETH Token: 0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4
WBTC Token: 0x7C4B1b2953Fd3bB0A4aC07da70b0839d1D09c2cA
Porto Delegation: 0x894C14A66508D221A219Dd0064b4A6718d0AAA52
```

## Commands

### Mobile Development
```bash
cd mobile && npm start       # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator  
npm run web                  # Run in web browser
```

### Contract Development
```bash
cd contracts
forge build                  # Compile contracts
forge test                   # Run tests
forge test --gas-report      # Gas optimization report
forge script script/DeployUnifiedCLOBV2.s.sol --rpc-url https://testnet.riselabs.xyz --broadcast
```

### Integration Testing
```bash
cd tests
node test-unified-clob-v2.js     # Test order placement
node test-market-orders.js        # Test market orders
node test-complete-flow.js        # Full integration test
node test-mobile-flow.js          # Test mobile app flow
```

## Architecture

### Project Structure
- `/contracts` - Foundry-based Solidity contracts
- `/mobile` - React Native app with Expo SDK 51
- `/tests` - Integration test suite
- `/external/porto-relay` - Porto relay reference implementation

### Key Technologies
- **Smart Contracts**: Solidity 0.8.23+, Foundry, OpenZeppelin
- **Mobile App**: React Native, Expo SDK 51, TypeScript
- **Porto Protocol**: EIP-7702 delegation, gasless transactions
- **Blockchain**: RISE testnet with synchronous transaction support
- **Testing**: Viem-based integration tests

## Porto Protocol Integration

### Overview
Porto Protocol enables gasless transactions through account delegation and sponsored relay services. It uses EIP-7702 to add smart account functionality to regular EOAs (Externally Owned Accounts).

### Key RPC Methods

#### wallet_prepareUpgradeAccount
Prepares an account for delegation by generating the necessary digests for signing.
```javascript
const prepareResponse = await relayCall('wallet_prepareUpgradeAccount', [{
  address: userAddress,
  delegation: DELEGATION_PROXY_ADDRESS,
  capabilities: { authorizeKeys: [] },
  chainId: CHAIN_ID
}]);
// Returns: { context, digests: { auth, exec } }
```

#### wallet_upgradeAccount  
Completes the delegation setup after signing the digests.
```javascript
await relayCall('wallet_upgradeAccount', [{
  context: prepareResponse.context,
  signatures: { 
    auth: authSignature,
    exec: execSignature 
  }
}]);
```

#### wallet_prepareCalls
Prepares gasless transaction intents for execution.
```javascript
const prepareResult = await relayCall('wallet_prepareCalls', [{
  from: userAddress,
  chainId: CHAIN_ID,
  calls: [{
    to: contractAddress,
    data: encodedData,
    value: '0x0'
  }],
  capabilities: {
    meta: { feeToken: '0x0000...0000' } // ETH for gasless
  },
  key: {
    prehash: false,
    publicKey: serializePublicKey(userAddress),
    type: 'secp256k1'
  }
}]);
// Returns: { context, digest }
```

#### wallet_sendPreparedCalls
Submits the signed intent to the blockchain.
```javascript
const sendResult = await relayCall('wallet_sendPreparedCalls', [{
  context: prepareResult.context,
  signature: signedDigest
}]);
// Returns: { bundleId, status }
```

#### wallet_getCallsStatus
Monitors transaction execution status.
```javascript
const status = await relayCall('wallet_getCallsStatus', [bundleId]);
// Returns: { status: 'pending' | 'success' | 'failed' }
```

### Porto Flow in Mobile App

1. **Account Setup** (`SetupScreen.tsx`)
   - Generate or load private key
   - Call `wallet_prepareUpgradeAccount`
   - Sign auth and exec digests
   - Call `wallet_upgradeAccount` to complete delegation

2. **Gasless Transactions** (`simple-porto.ts`)
   - Prepare transaction with `wallet_prepareCalls`
   - Sign the intent digest
   - Submit with `wallet_sendPreparedCalls`
   - Monitor status with `wallet_getCallsStatus`

3. **Key Management**
   - Private keys stored in Expo SecureStore
   - Session keys supported but not currently used
   - Delegation keys checked via `wallet_getKeys`

## RISE-Specific Features

### Synchronous Transactions
RISE supports `eth_sendRawTransactionSync` providing instant transaction receipts without waiting for block confirmation. The Porto relay leverages this for immediate transaction confirmation.

### Real-time Events  
WebSocket subscriptions via `rise_subscribe` deliver blockchain events in real-time.

### Gas Sponsorship
All transactions are sponsored through the Porto relay, meaning users never need ETH for gas fees.

## Development Workflow

1. **Contract Development**
   - Write contracts in `/contracts/src/`
   - Test with `forge test`
   - Deploy with deployment scripts
   - Extract ABIs for mobile app

2. **Mobile Development**
   - Update contract addresses in `/mobile/src/config/contracts.ts`
   - Update ABIs in `/mobile/src/config/abis/`
   - Test with Expo development server
   - Use hooks for contract interactions

3. **Testing Flow**
   - Run contract tests: `forge test`
   - Run integration tests: `node test-complete-flow.js`
   - Test mobile app: `npm start` in mobile directory

## Important Files

### Contracts
- `/contracts/src/UnifiedCLOBV2.sol` - Main CLOB contract with market orders
- `/contracts/src/tokens/MintableERC20.sol` - Test tokens with one-time mint

### Mobile App
- `/mobile/src/screens/SetupScreen.tsx` - Onboarding and delegation setup
- `/mobile/src/hooks/useCLOBContract.ts` - Trading operations hook
- `/mobile/src/lib/porto/simple-porto.ts` - Porto relay integration
- `/mobile/src/config/contracts.ts` - Contract addresses and configuration

### Testing
- `/tests/lib/porto-clob-utils.js` - Utility functions for gasless transactions
- `/tests/test-complete-flow.js` - Comprehensive integration test
- `/tests/test-market-orders.js` - Market order functionality test

## Error Handling Patterns

### Porto Relay Errors
- `wallet_getKeys` may fail for new accounts (expected)
- `0xfbcb0b34` error indicates hash mismatch (usually wrong nonce)
- "already known" means transaction is in mempool
- "missing nonce" indicates gap in transaction sequence

### Contract Errors  
- Check delegation status before trading operations
- Verify token approvals before deposits
- Handle slippage protection for market orders
- Validate order book IDs (1: WETH/USDC, 2: WBTC/USDC)

## UnifiedCLOBV2 Contract Features

### Order Types
- **Limit Orders**: Traditional price-time priority matching
- **Market Orders**: Instant execution with slippage protection (NEW!)

### Key Functions
```solidity
// Place a limit order
function placeOrder(
    uint256 bookId,
    OrderType orderType,  // BUY = 0, SELL = 1
    uint256 price,        // Price in quote token decimals
    uint256 amount        // Amount normalized to 18 decimals
)

// Place a market order with slippage protection
function placeMarketOrder(
    uint256 bookId,
    OrderType orderType,
    uint256 amount,       // Amount in 18 decimals
    uint256 maxSlippage   // Basis points (100 = 1%)
) returns (uint256 totalFilled, uint256 avgPrice)

// Deposit tokens to CLOB
function deposit(address token, uint256 amount)

// Withdraw tokens from CLOB
function withdraw(address token, uint256 amount)

// Manual order matching (for limit orders)
function matchOrders(uint256 bookId)
```

### Trading Books
- Book 1: WETH/USDC (Ethereum vs USD Coin)
- Book 2: WBTC/USDC (Bitcoin vs USD Coin)

### Decimal Normalization
- All amounts in the contract are normalized to 18 decimals
- Prices use quote token decimals (USDC = 6, WBTC = 8)
- The contract handles decimal conversion internally

## Code Style Guidelines

### Mobile App (React Native/TypeScript)
- Maintain strict TypeScript types - no `any` types
- Use functional components with hooks
- Follow React Native best practices
- Handle errors gracefully with user-friendly messages
- Log important operations with the logger utility
- Ensure `npm run build` passes without errors

### Smart Contracts (Solidity)
- Follow Solidity 0.8.23+ best practices
- Write comprehensive unit tests
- Use `forge fmt` for formatting
- Document gas costs for operations
- Emit events for all state changes
- Use OpenZeppelin contracts where applicable

### Testing
- Write integration tests for all user flows
- Test with realistic gas limits
- Verify state changes after transactions
- Test error conditions and edge cases
- Document test purpose and expected outcomes

## External Resources

- **Foundry Book**: https://book.getfoundry.sh/
- **Porto Protocol**: https://porto.sh
- **RISE Chain Docs**: https://docs.risechain.com
- **React Native**: https://reactnative.dev/
- **Expo Documentation**: https://docs.expo.dev/
- **Viem Documentation**: https://viem.sh/

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.