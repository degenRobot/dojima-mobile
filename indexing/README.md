# CLOB Indexer

This indexer uses [Ponder](https://ponder.sh) v0.11 to index events from the CLOB (Central Limit Order Book) smart contracts on RISE testnet. It provides a GraphQL API for querying order book data, trades, user balances, and market information.

## Overview

The indexer tracks the following contracts:
- **EnhancedSpotBook**: The main order book contract for spot trading
- **SpotFactory**: Factory contract that deploys new trading pairs
- **ERC20**: Standard token contract for tracking transfers and approvals

## Getting Started

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm
- RPC endpoint for RISE testnet

### Installation

```bash
cd indexing
npm install
```

### Configuration

Set your RPC endpoint in the environment:
```bash
export PONDER_RPC_URL_1="https://testnet.riselabs.xyz"
```

### Running the Indexer

```bash
npm run dev
```

The indexer will:
1. Sync historical events from the configured start blocks
2. Process events and store them in a local PGlite database
3. Serve a GraphQL API at `http://localhost:42069`

## Architecture

### Schema (`ponder.schema.ts`)

The indexer maintains the following data models:

**User & Balance Tracking:**
- `account`: User accounts with trade statistics
- `balance`: Token balances (available/locked) per user per market
- `deposit`/`withdrawal`: Token deposit and withdrawal events

**Order Management:**
- `orderHistory`: Complete order history with status tracking
- `activeOrder`: Currently open orders for order book reconstruction
- `priceLevel`: Aggregated price levels for efficient order book display

**Trading Data:**
- `trade`: Executed trades with maker/taker details
- `userTrade`: User-specific trade history
- `market`: Trading pairs configuration

**Market Analytics:**
- `market24hStats`: Rolling 24-hour volume and price statistics
- `marketPrice`: Latest price and price changes
- `hourlyVolume`: Hourly volume aggregation
- `priceCandle`: OHLCV candle data for charts

### Event Handlers

1. **EnhancedSpotBook Events** (`src/EnhancedSpotBook.ts`):
   - `OrderPlaced`: Creates order history and active orders
   - `OrderMatched`: Records trades, creates user trades, updates balances
   - `OrderStatusChanged`: Updates order status in history
   - `OrderRemovedFromBook`: Removes from active orders
   - `OrderCancelled`: Marks orders as cancelled, unlocks balances
   - `Deposited`/`Withdrawn`: Updates user balances

2. **SpotFactory Events** (`src/factory.ts`):
   - `SpotPairCreated`: Registers new trading pairs

## GraphQL API

The indexer exposes a GraphQL endpoint at `http://localhost:42069`.

### Important Notes on Relations

In Ponder v0.11, relation fields (like `trader`, `market`) are objects, not strings. When querying, you must specify subfields:

```graphql
# ❌ Wrong - will error
trader

# ✅ Correct - specify subfields
trader {
  address
}
```

### Key Queries

#### Get User Order History
```graphql
query GetUserOrders($trader: String!) {
  orderHistorys(
    where: { trader: $trader }
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      orderId
      trader {
        address
      }
      market {
        address
        name
      }
      isBuy
      orderType
      price
      originalAmount
      filledAmount
      status
      createdAt
      updatedAt
    }
  }
}
```

#### Get Order Book
```graphql
query GetOrderBook($market: String!) {
  buyOrders: activeOrders(
    where: { market: $market, isBuy: true }
    orderBy: "price"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      orderId
      price
      remainingAmount
      trader {
        address
      }
    }
  }
  sellOrders: activeOrders(
    where: { market: $market, isBuy: false }
    orderBy: "price"
    orderDirection: "asc"
    limit: 20
  ) {
    items {
      orderId
      price
      remainingAmount
      trader {
        address
      }
    }
  }
}
```

#### Get Recent Trades
```graphql
query GetRecentTrades($market: String!) {
  trades(
    where: { market: $market }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      id
      price
      amount
      timestamp
      buyer {
        address
      }
      seller {
        address
      }
      taker
    }
  }
}
```

#### Get User Trades
```graphql
query GetUserTrades($trader: String!) {
  userTrades(
    where: { trader: $trader }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      id
      orderId
      side
      role
      price
      amount
      fee
      timestamp
    }
  }
}
```

#### Get Market Stats
```graphql
query GetMarketStats($market: String!) {
  market24hStats(market: $market) {
    volume24h
    trades24h
    high24h
    low24h
  }
  marketPrice(market: $market) {
    lastPrice
    priceChange24h
    priceChange1h
  }
}
```

## Frontend Integration

The frontend uses `graphql-request` for querying the indexer. Key integration points:

### GraphQL Client Configuration

```typescript
// src/lib/graphql-client.ts
import { GraphQLClient } from 'graphql-request';

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:42069';

export const gqlClient = new GraphQLClient(INDEXER_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Example Hooks

```typescript
// useOrderHistory hook
export function useOrderHistory(marketAddress?: string) {
  const { address } = useAccount();
  
  const query = useQuery({
    queryKey: ['orderHistory', address, marketAddress],
    queryFn: async () => {
      if (!address) return [];
      
      const response = await gqlClient.request(GET_USER_ORDERS, {
        trader: address.toLowerCase(),
        limit: 100,
      });
      
      return response.orderHistorys.items.map(transformOrder);
    },
    enabled: !!address,
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  return {
    orders: query.data || [],
    loading: query.isLoading,
    error: query.error,
  };
}
```

### Price Formatting

All amounts and prices are stored as BigInt strings. Convert for display:

```typescript
import { formatUnits } from 'viem';

// Convert price from wei to display format
const price = Number(formatUnits(BigInt(order.price), 18));
const amount = Number(formatUnits(BigInt(order.originalAmount), 18));
```

## Development

### Current Event Statistics

The indexer has successfully processed:
- 38 OrderPlaced events
- 12 OrderMatched events (trades)
- 26 OrderStatusChanged events
- 17 OrderRemovedFromBook events
- 3 OrderCancelled events
- 6 Deposited events
- 2 Withdrawn events

### Testing

#### Running Integration Tests

The indexer includes comprehensive integration tests that verify all GraphQL queries:

```bash
# Run all tests (requires indexer to be running)
npm test

# Or run directly
node test-indexer.js
```

The test suite covers:
- Basic connectivity
- Order history queries
- Active order book
- Recent trades
- User trades and balances
- Market statistics
- Pagination
- Filter combinations

All tests run against the live indexer and verify:
- Data structure and types
- Query filtering and sorting
- Relationship integrity
- BigInt value parsing

#### Manual Query Testing

Test the GraphQL endpoint:

```bash
# Test basic connection
curl -X POST http://localhost:42069/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { status } }"}'

# Get order history
curl -X POST http://localhost:42069/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ orderHistorys(limit: 5) { items { id status price originalAmount trader { address } } } }"
  }'
```

### Database Management

Reset the database:
```bash
rm -rf .ponder
npm run dev
```

### Adding New Event Handlers

1. Update the contract ABI in `abis/` if needed
2. Add event handler in the appropriate file (`src/EnhancedSpotBook.ts`, etc.)
3. Update schema in `ponder.schema.ts` if new entities are needed
4. Run `npm run dev` to regenerate types

## Troubleshooting

### Common Issues

1. **"Field must have a selection of subfields" error**
   - This occurs when querying relation fields without specifying subfields
   - Solution: Add `{ address }` or other subfields to relation fields

2. **Database corruption errors**
   - PGlite database can become corrupted during development
   - Solution: `rm -rf .ponder` and restart

3. **Missing data**
   - Check that contract addresses and start blocks are correct in `ponder.config.ts`
   - Verify RPC endpoint is accessible

4. **Slow initial sync**
   - Initial sync processes all historical events
   - Consider adjusting start blocks for faster development

### Debug Logging

Enable verbose logging:
```bash
DEBUG=ponder:* npm run dev
```

## Contract Addresses (RISE Testnet)

- SpotFactory: `0xb4d719B6131E9E924d693321c0c4cCE03041d2f2`
- EnhancedSpotBook: `0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222`
- MockUSDC: `0x6f127dc335c98a621111a686d0f2a6c0f4f5ea05`

## Current Status

### ✅ Implemented
- Order placement, matching, cancellation tracking
- User balance tracking (deposits/withdrawals)
- Trade execution recording with maker/taker details
- Order book reconstruction from active orders
- Market stats (volume, high/low, trades count)
- Price tracking with change percentages
- User trade history
- Minute-precision timestamps for candle aggregation
- Comprehensive GraphQL API
- Integration tests with 100% query coverage

### 🚧 In Progress
- Rolling 24h window for market stats (currently cumulative)
- 1-hour price change tracking
- Real token symbol resolution (currently using address prefixes)
- Dynamic fee rate reading from contract

### ❌ Not Implemented
- Perpetual futures indexing
- Cross-market volume aggregation
- Liquidation events
- Funding rate tracking
- Position tracking for perps

## Known Issues

1. **Market Entity**: Markets need to be created through SpotFactory for proper tracking
2. **24h Stats**: Using cumulative stats instead of rolling 24h window
3. **Fee Rates**: Hardcoded to 0.1% maker, 0.3% taker
4. **Token Symbols**: Using address prefixes instead of fetching actual symbols
5. **PGlite Corruption**: Database can corrupt during development, requiring deletion

## Performance Metrics

- **Event Processing**: ~0.05-1.4ms per event
- **Initial Sync**: ~2-3 minutes for 250k blocks
- **GraphQL Response**: <50ms for most queries
- **Database Size**: ~50MB for 100+ trades

## Production Considerations

1. **Database**: Use PostgreSQL for production instead of PGlite
2. **RPC Endpoints**: Use dedicated RPC endpoints with proper rate limiting
3. **Start Blocks**: Optimize start blocks to reduce initial sync time
4. **Monitoring**: Set up health checks and monitoring for the GraphQL endpoint
5. **Caching**: Implement caching strategies for frequently accessed data
6. **Backup**: Regular database backups for disaster recovery
7. **Rate Limiting**: Add rate limiting to GraphQL endpoint

## Resources

- [Ponder v0.11 Documentation](https://ponder.sh)
- [GraphQL Documentation](https://graphql.org/learn/)
- [RISE Testnet Explorer](https://explorer.testnet.riselabs.xyz)
- [Viem Documentation](https://viem.sh) (for BigInt handling)

## See Also

- [Frontend Integration Guide](./FRONTEND_INTEGRATION.md) - Detailed guide for integrating the indexer into frontend applications
- [Test Documentation](./tests/README.md) - Information about running and writing tests