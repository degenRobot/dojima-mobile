# Dojima Mobile - Integration Tests

Integration and end-to-end tests for the Dojima Mobile CLOB platform on RISE Chain.

## Available Tests

### Core CLOB Tests
- `test-unified-clob-v2.js` - Tests UnifiedCLOBV2 contract with gasless transactions
- `test-market-orders.js` - Tests market order features with slippage protection

### Mobile App Flow Tests  
- `test-complete-mobile-flow.js` - Complete mobile app integration flow
- `test-mobile-flow.js` - Basic mobile app flow with Porto delegation

### Indexer Integration
- `test-indexer-integration.js` - Tests CLOB + Ponder indexer integration with GraphQL queries

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm run test:v2              # UnifiedCLOBV2 tests
npm run test:indexer         # Indexer integration test

# Or run directly
node test-unified-clob-v2.js
node test-market-orders.js
node test-indexer-integration.js
```

## Environment Setup

Create a `.env` file in the parent directory:
```env
PRIVATE_KEY=0x...  # Your test wallet private key
```

## Libraries

- `lib/porto-clob-utils.js` - Porto protocol integration for gasless transactions
- `lib/unified-clob-utils.js` - UnifiedCLOB contract interaction utilities  
- `lib/decimal-utils.js` - Decimal conversion utilities for proper price formatting
- `lib/simple-porto.js` - Simplified Porto relay client

## Decimal Handling

When placing orders, prices must be in the quote token's decimals:
- WETH/USDC: price in 6 decimals (e.g., 2000 USDC = 2000 * 10^6)
- WBTC/USDC: price in 6 decimals (e.g., 50000 USDC = 50000 * 10^6)
- Amounts are always normalized to 18 decimals

## Configuration

Tests use configuration from `relay.json`:
- RISE testnet RPC/WebSocket URLs
- Porto relay endpoint
- UnifiedCLOBV2 contract address
- Token contract addresses