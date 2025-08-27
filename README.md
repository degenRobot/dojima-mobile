# Dojima Mobile - Decentralized Trading Platform on RISE

A comprehensive mobile and web trading platform featuring an on-chain Central Limit Order Book (CLOB), gasless transactions via Porto Protocol, and real-time order execution on RISE blockchain.

## Overview

Dojima Mobile provides a complete trading ecosystem with:

- **UnifiedCLOBV2 Contract**: Advanced order book with limit and market orders
- **Gasless Trading**: Porto Protocol integration for sponsored transactions
- **Mobile-First Design**: React Native app with Expo SDK 51
- **Market Orders**: Instant execution with slippage protection
- **Real-time Updates**: WebSocket integration for live order book
- **Comprehensive Testing**: Full test coverage with Porto relay integration

## Key Features

### Technical Stack
- **Smart Contracts**: Solidity 0.8.23+ with Foundry framework
- **Mobile App**: React Native with Expo SDK 51
- **Porto Protocol**: EIP-7702 delegation for gasless transactions  
- **Blockchain**: RISE Testnet (Chain ID: 11155931)
- **Testing**: Comprehensive test suite with market order support

### Trading Features
- **Limit Orders**: Price-time priority matching
- **Market Orders**: Instant execution with slippage protection (NEW!)
- **Gasless Trading**: All fees sponsored via Porto relay
- **One-Click Setup**: Account delegation and token minting
- **Real-time Updates**: Live order book and balance updates

### Porto Protocol Integration
- **Account Delegation**: EIP-7702 smart account functionality
- **Sponsored Transactions**: No gas fees for users
- **Session Keys**: Secure key management with Expo SecureStore
- **Intent-Based Execution**: Batched operations for efficiency

## Architecture

```
Dojima Mobile System
├── Smart Contracts
│   ├── UnifiedCLOBV2.sol        # Order book with market orders
│   ├── MintableERC20.sol        # Test tokens with one-time mint
│   └── Porto Integration        # EIP-7702 delegation
│
├── Mobile Application
│   ├── screens/                 # Trading, Portfolio, Markets
│   │   ├── SetupScreen         # Onboarding with delegation
│   │   ├── TradingScreen       # Order placement & deposits
│   │   └── PortfolioScreen    # Balance management
│   ├── hooks/                   # Custom React hooks
│   │   ├── useCLOBContract    # Trading operations
│   │   ├── usePortfolio       # Balance tracking
│   │   └── useRelayer         # Porto relay integration
│   └── lib/porto/              # Gasless transaction logic
│
├── Porto Relay Integration
│   ├── wallet_prepareCalls      # Intent preparation
│   ├── wallet_sendPreparedCalls # Transaction submission
│   ├── wallet_upgradeAccount    # Account delegation
│   └── wallet_getCallsStatus   # Transaction monitoring
│
└── Testing Suite
    ├── test-unified-clob-v2.js  # Contract integration
    ├── test-market-orders.js    # Market order testing
    └── test-complete-flow.js   # End-to-end validation
```

## Quick Start

### Prerequisites
- Node.js 18+
- Foundry (for smart contract development)
- Expo CLI (for mobile development)
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/dojima-mobile.git
cd dojima-mobile

# Install dependencies
npm install

# Install contract dependencies
cd contracts && forge install && cd ..

# Install mobile dependencies
cd mobile && npm install && cd ..

# Install test dependencies
cd tests && npm install && cd ..
```

### Running the Mobile App

```bash
# Start the mobile app
cd mobile
npm start

# For iOS (Mac only)
npm run ios

# For Android
npm run android

# For web
npm run web
```

### Deploy Contracts (Optional)

```bash
cd contracts
forge script script/DeployUnifiedCLOBV2.s.sol --rpc-url https://testnet.riselabs.xyz --broadcast
```

## Network Configuration

### RISE Testnet Parameters
- **Network Name**: RISE Testnet
- **Chain ID**: 11155931
- **Currency Symbol**: ETH
- **Block Explorer**: https://explorer.testnet.riselabs.xyz

### RPC Endpoints
- **HTTPS RPC**: https://testnet.riselabs.xyz
- **WebSocket**: wss://testnet.riselabs.xyz/ws
- **Porto Relay**: https://rise-testnet-porto.fly.dev

## Contract Addresses (Latest Deployment)

### Core Contracts
- **UnifiedCLOBV2**: `0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C`
- **Porto Delegation Proxy**: `0x894C14A66508D221A219Dd0064b4A6718d0AAA52`
- **Porto Orchestrator**: `0xa4D0537eEAB875C9a880580f38862C1f946bFc1c`

### Test Tokens (MintableERC20)
- **USDC**: `0xC23b6B892c947746984474d52BBDF4ADd25717B3` (6 decimals)
- **WETH**: `0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4` (18 decimals)
- **WBTC**: `0x7C4B1b2953Fd3bB0A4aC07da70b0839d1D09c2cA` (8 decimals)

### Trading Books
- **Book 1**: WETH/USDC
- **Book 2**: WBTC/USDC

## Development

### Commands
```bash
# Contracts
cd contracts
forge test                # Run contract tests
forge test --gas-report   # Gas optimization report
forge build               # Compile contracts

# Mobile App
cd mobile
npm start                 # Start Expo dev server
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator
npm run web              # Run in web browser
npm run build            # Build for production

# Testing
cd tests
node test-unified-clob-v2.js    # Test order placement
node test-market-orders.js       # Test market orders
node test-complete-flow.js       # Full integration test
node test-mobile-flow.js         # Test mobile app flow
```

### Project Structure
```
dojima-mobile/
├── contracts/            # Smart contracts (Foundry)
│   ├── src/             # Contract implementations
│   │   ├── UnifiedCLOBV2.sol     # Main CLOB contract
│   │   └── tokens/               # Test token contracts
│   ├── script/          # Deployment scripts
│   └── test/            # Contract tests
│
├── mobile/              # React Native app (Expo)
│   ├── src/
│   │   ├── screens/     # App screens
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/porto/   # Porto integration
│   │   └── config/      # App configuration
│   └── app.json         # Expo configuration
│
├── tests/               # Integration tests
│   ├── lib/             # Test utilities
│   ├── abis/            # Contract ABIs
│   └── test-*.js        # Test scripts
│
├── external/            # External dependencies
│   └── porto-relay/     # Porto relay reference
│
└── TODOLIST.md         # Development roadmap
```

## Testing

### Smart Contract Tests
```bash
cd contracts
forge test                           # Run all tests
forge test --match-test testName     # Run specific test
forge test --gas-report              # Gas usage report
```

### Frontend E2E Tests
```bash
cd frontend
npm run test:e2e                     # Run Playwright tests
npx playwright test --ui             # Run with UI mode
```

### Test Coverage
- Contract unit tests with Foundry
- Integration tests for contract interactions
- E2E tests for trading interface
- GraphQL API tests

## API Reference

### GraphQL Endpoint
```
http://localhost:42069/graphql
```

### Available Queries
- `activeOrders` - Get active orders for a market
- `orderHistorys` - Get order history for a trader
- `trades` - Get recent trades
- `marketPrices` - Get market price data
- `market24hStatss` - Get 24h market statistics

### WebSocket Events
The frontend automatically subscribes to contract events via RISE's WebSocket API for real-time updates.

## Troubleshooting

### Common Issues

1. **Frontend shows "Loading"**: Ensure the indexer is running (`cd indexing && npm run dev`)
2. **GraphQL errors**: Check that contracts are deployed and indexer has synced
3. **Port conflicts**: Frontend runs on 3001, indexer on 42069
4. **Build errors**: Run `npm install` in each directory

## Resources

- [Contract Architecture](./contracts/Architecture.md)
- [RISE Chain Docs](https://docs.risechain.com)
- [Ponder Docs](https://ponder.sh)

## License

MIT - see [LICENSE](LICENSE) for details.