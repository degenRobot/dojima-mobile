# Indexer Tests

This directory contains integration and unit tests for the CLOB indexer.

## Test Structure

- `integration.test.ts` - Full integration tests that start the indexer and test GraphQL queries
- `queries.test.ts` - Unit tests for query construction and validation
- `helpers.ts` - Common test utilities and helper functions

## Running Tests

### Prerequisites

Install test dependencies:
```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Integration Tests Only

```bash
npm run test:integration
```

Note: Integration tests will start the indexer automatically and may take up to a minute to complete.

### Run in Watch Mode

```bash
npm test -- --watch
```

## What's Tested

### Integration Tests
- GraphQL endpoint connectivity
- Market queries and filtering
- Order book queries (buy/sell orders)
- Order history with trader filtering
- Trade queries and user trades
- Balance queries with calculations
- Deposit/withdrawal queries
- Pagination functionality
- Data integrity (relationships, BigInt values)

### Unit Tests
- Query construction for all major query types
- Filter combinations
- Pagination parameters
- Nested relation queries

## Test Data

The tests run against the live indexer connected to RISE testnet. They verify:
- Data structure and types
- Query filtering and sorting
- Relationship integrity
- BigInt value parsing
- Business logic (e.g., total = available + locked)

## Writing New Tests

Use the helpers from `helpers.ts`:

```typescript
import { 
  createTestClient, 
  formatPrice, 
  assertValidOrder,
  TEST_MARKET_ADDRESS 
} from './helpers';

it('should test something', async () => {
  const client = createTestClient();
  
  const response = await client.request(MY_QUERY, {
    market: TEST_MARKET_ADDRESS
  });
  
  assertValidOrder(response.order);
});
```

## Troubleshooting

1. **Indexer fails to start**: Check that port 42069 is not in use
2. **Timeout errors**: Increase timeout in `vitest.config.ts`
3. **Connection refused**: Ensure RPC endpoint is accessible
4. **Database errors**: Run `rm -rf ../.ponder` to reset

## CI/CD

For CI environments, use:
```bash
npm run test:ci
```

This runs tests with verbose output and exits after completion.