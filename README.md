# Dojima - Central Limit Order Book (CLOB) on RISE

A full-stack decentralized exchange implementation featuring an on-chain order book, real-time indexing, and modern trading interface built on RISE blockchain.

## Overview

Dojima provides a complete DEX ecosystem with:

- **On-chain Order Book**: Gas-optimized limit order matching engine
- **Real-time Indexing**: Ponder-based event indexing with GraphQL API
- **Modern Trading UI**: React-based interface with order book visualization
- **WebSocket Integration**: Live updates for orders and trades
- **Factory Pattern**: Modular deployment system for trading pairs
- **Comprehensive Testing**: Full test coverage including E2E Playwright tests

## Key Features

### Technical Stack
- **Smart Contracts**: Solidity with Foundry framework
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS v4
- **Indexing**: Ponder v0.11 with GraphQL API
- **Real-time**: RISE WebSocket subscriptions
- **Testing**: Foundry tests + Playwright E2E tests

### Trading Features
- Limit orders with price-time priority
- Order book depth visualization
- Real-time order matching
- Deposit/withdraw interface
- Balance management

### Developer Experience
- Auto-generated contract types
- React hooks for contract interactions
- GraphQL client with caching
- Hot module replacement
- Comprehensive test coverage

## Architecture

```
Dojima CLOB System
├── Core Contracts
│   ├── OrderBook.sol           # Abstract base order book
│   ├── CLOBRegistry.sol        # Global registry and volume tracking
│   ├── CLOBFactoryModular.sol  # Modular factory system
│   └── SpotFactory.sol         # Spot pair deployment
│
├── Trading Features
│   ├── EnhancedSpotBook.sol    # Production spot trading
│   ├── SpotBook.sol            # Basic spot implementation
│   ├── PerpBook.sol            # Perpetual futures (example)
│   └── LeverageTrading.sol     # Margin trading system
│
├── Fee System
│   ├── GlobalFeeHook.sol       # Dynamic fee calculations (CREATE2)
│   ├── FeeDistributor.sol      # Revenue distribution
│   └── LiquidityMiningHook.sol # LP incentives
│
└── Indexing & API
    ├── Ponder Indexer          # Real-time event processing
    ├── GraphQL API             # Query interface
    └── WebSocket API           # Live order book updates
```

## Quick Start

### Prerequisites
- Node.js 18+
- Foundry (for smart contract development)
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/dojima.git
cd dojima

# Install dependencies
npm install

# Install contract dependencies
cd contracts && forge install
```

### Running the Application

1. **Start the Indexer** (required for GraphQL API):
```bash
cd indexing
npm run dev
```

2. **Start the Frontend**:
```bash
cd frontend
npm run dev
```

3. **Deploy Contracts** (optional - testnet contracts already deployed):
```bash
npm run deploy-and-sync -- -s DeployModularCLOB
```

Visit http://localhost:3001 to access the trading interface.

## Contract Addresses (RISE Testnet)

### Core Infrastructure (Updated 2025-07-19)
- **CLOBRegistry**: `0x2188C521c03DCcFf0C8b55B2A55D29B106F548b1`
- **CLOBFactoryModular**: `0x005ba978527eE83f722Cc1822D3F87d8dBcb6B55`
- **SpotFactory**: `0x2661816e0e8a210084817a87ae5c9A2D7638004C`
- **GlobalFeeHook**: `0x7EBE5AA248F62837aeb5315FeB95A055ed930A24`
- **FeeDistributor**: `0xC0A738e222C78d1F3658Cff6C534715DBC17fa5F`

### Live Trading Pairs
- **WETH-USDC**: `0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222` (EnhancedSpotBook)

### Test Tokens
- **WETH (Mock)**: `0x0da0E0657016533CB318570d519c62670A377748`
- **USDC (Mock)**: `0x71a1A92DEF5A4258788212c0Febb936041b5F6c1`

## Development

### Commands
```bash
# Contracts
cd contracts
forge test                # Run contract tests
forge test --gas-report   # Gas optimization report

# Frontend
cd frontend
npm run dev               # Start development server (port 3001)
npm run build             # Production build
npm run lint              # Code linting
npm run type-check        # TypeScript validation
npm run test:e2e          # Run Playwright tests

# Indexing
cd indexing
npm run dev               # Start Ponder indexer (port 42069)
npm run codegen           # Generate GraphQL types

# Full Stack
npm run dev               # Start all services
npm run deploy-and-sync   # Deploy contracts & sync
```

### Project Structure
```
dojima/
├── contracts/            # Smart contracts (Foundry)
│   ├── src/             # Contract implementations
│   ├── script/          # Deployment scripts
│   └── test/            # Contract tests
│
├── frontend/            # Trading interface (Next.js)
│   ├── src/app/         # App routes
│   ├── src/components/  # UI components
│   └── src/hooks/       # Contract interactions
│
├── indexing/            # Event indexer (Ponder)
│   ├── src/             # Event handlers
│   ├── ponder.schema.ts # GraphQL schema
│   └── ponder.config.ts # Indexer configuration
│
├── tests/               # E2E tests (Playwright)
│   └── *.spec.ts        # Test specifications
│
└── open-clob/           # Core CLOB library reference
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