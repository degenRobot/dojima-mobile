# UnifiedCLOB Tests

This directory contains test utilities and scripts for the UnifiedCLOB contract with Porto gasless transaction support.

## Test Files

- `test-unified-clob.js` - Basic CLOB testing with Porto integration
- `test-unified-clob-decimals.js` - Tests proper decimal handling for different token pairs
- `test-unified-clob-with-checks.js` - Enhanced tests with state verification

## Libraries

- `lib/porto-clob-utils.js` - Porto protocol integration for gasless transactions
- `lib/unified-clob-utils.js` - UnifiedCLOB contract interaction utilities
- `lib/decimal-utils.js` - Decimal conversion utilities for proper price formatting

## Important: Decimal Handling

When placing orders, prices must be in the quote token's decimals:
- WETH/USDC: price in 6 decimals (e.g., 2000 USDC = 2000 * 10^6)
- WBTC/USDC: price in 6 decimals (e.g., 50000 USDC = 50000 * 10^6)
- WETH/WBTC: price in 8 decimals (e.g., 0.04 BTC = 0.04 * 10^8)

## Running Tests

```bash
# Install dependencies
npm install

# Run specific test
node test-unified-clob-decimals.js

# Run with state verification
node test-unified-clob-with-checks.js
```

## Configuration

Tests use configuration from `relay.json` or `relay-decimals.json` which contains:
- Network settings (RPC, WebSocket URLs)
- Porto relayer configuration
- Contract addresses
- Token decimal specifications