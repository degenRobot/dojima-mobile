# CLOB Indexer GraphQL API Reference

## Endpoint

```
http://localhost:42069/graphql
```

## Core Types

### Market
```graphql
type market {
  address: String!          # Contract address of the trading pair
  pairId: BigInt!          # Unique pair ID
  type: String!            # "SPOT" or "PERP"
  baseToken: String!       # Base token address
  quoteToken: String!      # Quote token address
  name: String!            # Display name (e.g., "ETH-USDC")
  deployedAt: Int!         # Deployment timestamp
  isActive: Boolean!       # Whether trading is active
}
```

### Active Order
```graphql
type activeOrder {
  id: String!              # Unique identifier
  orderId: BigInt!         # On-chain order ID
  trader: account!         # Order creator
  market: market!          # Trading pair
  isBuy: Boolean!          # true for buy, false for sell
  price: BigInt!           # Price in wei
  originalAmount: BigInt!  # Original order size
  remainingAmount: BigInt! # Unfilled amount
  timestamp: Int!          # Order creation time
}
```

### Trade
```graphql
type trade {
  id: String!              # Unique identifier
  market: market!          # Trading pair
  price: BigInt!           # Execution price
  amount: BigInt!          # Trade size
  buyer: account!          # Buy side trader
  seller: account!         # Sell side trader
  buyOrderId: BigInt!      # Buy order ID
  sellOrderId: BigInt!     # Sell order ID
  timestamp: Int!          # Execution time
  blockNumber: Int!        # Block number
  txHash: String!          # Transaction hash
}
```

### Balance
```graphql
type balance {
  id: String!              # Composite key
  user: account!           # Account owner
  market: market!          # Trading pair
  token: String!           # Token address
  available: BigInt!       # Available balance
  locked: BigInt!          # Locked in orders
  total: BigInt!           # Total (available + locked)
  lastUpdate: Int!         # Last update timestamp
}
```

## Query Examples

### 1. Get All Markets
```graphql
query GetAllMarkets {
  markets {
    items {
      address
      name
      baseToken
      quoteToken
      type
      isActive
    }
  }
}
```

### 2. Get Order Book
```graphql
query GetOrderBook($marketAddress: String!) {
  # Buy orders (sorted high to low)
  buyOrders: activeOrders(
    where: { 
      market: $marketAddress, 
      isBuy: true,
      remainingAmount_gt: "0"
    }
    orderBy: "price"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      price
      remainingAmount
      trader {
        address
      }
    }
  }
  
  # Sell orders (sorted low to high)
  sellOrders: activeOrders(
    where: { 
      market: $marketAddress, 
      isBuy: false,
      remainingAmount_gt: "0"
    }
    orderBy: "price"
    orderDirection: "asc"
    limit: 20
  ) {
    items {
      price
      remainingAmount
      trader {
        address
      }
    }
  }
}
```

### 3. Get User Orders
```graphql
query GetUserOrders($userAddress: String!, $marketAddress: String!) {
  activeOrders(
    where: { 
      trader: $userAddress,
      market: $marketAddress
    }
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      orderId
      isBuy
      price
      originalAmount
      remainingAmount
      timestamp
    }
  }
}
```

### 4. Get Recent Trades
```graphql
query GetRecentTrades($marketAddress: String!, $limit: Int = 20) {
  trades(
    where: { market: $marketAddress }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
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
    }
  }
}
```

### 5. Get User Balances
```graphql
query GetUserBalances($userAddress: String!, $marketAddress: String!) {
  balances(
    where: { 
      user: $userAddress,
      market: $marketAddress
    }
  ) {
    items {
      token
      available
      locked
      total
    }
  }
}
```

### 6. Get Market Stats
```graphql
query GetMarketStats($marketAddress: String!) {
  market24hStats(id: $marketAddress) {
    volume24h
    trades24h
    high24h
    low24h
    lastUpdate
  }
  
  # Latest price
  marketPrice(id: $marketAddress) {
    lastPrice
    lastUpdate
  }
}
```

### 7. Get Price Candles (OHLCV)
```graphql
query GetPriceCandles($marketAddress: String!, $interval: String!, $since: Int!) {
  priceCandles(
    where: { 
      market: $marketAddress,
      interval: $interval,
      timestamp_gte: $since
    }
    orderBy: "timestamp"
    orderDirection: "asc"
  ) {
    items {
      timestamp
      open
      high
      low
      close
      volume
      trades
    }
  }
}
```

### 8. Get Order History
```graphql
query GetOrderHistory($userAddress: String!, $marketAddress: String!) {
  orderHistorys(
    where: { 
      trader: $userAddress,
      market: $marketAddress
    }
    orderBy: "placedAt"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      orderId
      isBuy
      price
      originalAmount
      filledAmount
      status
      placedAt
      completedAt
    }
  }
}
```

## Pagination

All list queries support pagination:

```graphql
query GetTradesWithPagination($market: String!, $skip: Int!, $first: Int!) {
  trades(
    where: { market: $market }
    skip: $skip
    first: $first
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      price
      amount
    }
  }
}
```

## Filtering

Use the `where` parameter for filtering:

```graphql
where: {
  # Exact match
  market: "0x123..."
  
  # Comparison operators
  price_gt: "1000000000000000000"      # Greater than
  price_gte: "1000000000000000000"     # Greater than or equal
  price_lt: "2000000000000000000"      # Less than
  price_lte: "2000000000000000000"     # Less than or equal
  price_not: "1500000000000000000"     # Not equal
  
  # Boolean
  isBuy: true
  
  # In array
  status_in: ["FILLED", "PARTIALLY_FILLED"]
  
  # Null checks
  completedAt_not: null
}
```

## Real-time Updates

### Option 1: Polling
```typescript
const { data, loading, error } = useQuery(GET_ORDER_BOOK, {
  variables: { marketAddress },
  pollInterval: 5000, // Poll every 5 seconds
});
```

### Option 2: Refetch After Transaction
```typescript
const [placeOrder] = useMutation(PLACE_ORDER, {
  onCompleted: () => {
    // Refetch queries after order placement
    refetch();
  },
});
```

## Error Handling

The API returns standard GraphQL errors:

```json
{
  "errors": [
    {
      "message": "Field error description",
      "locations": [{ "line": 1, "column": 1 }],
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED"
      }
    }
  ]
}
```

## Rate Limiting

Currently no rate limiting in development. Production deployments should implement:
- Request throttling
- Query complexity limits
- Depth limiting

## Best Practices

1. **Use Fragments** for reusable field selections:
```graphql
fragment OrderFields on activeOrder {
  orderId
  price
  remainingAmount
  isBuy
}

query GetOrders($market: String!) {
  activeOrders(where: { market: $market }) {
    items {
      ...OrderFields
    }
  }
}
```

2. **Batch Queries** when fetching related data:
```graphql
query GetMarketData($market: String!) {
  marketInfo: market(id: $market) {
    name
    baseToken
    quoteToken
  }
  
  stats: market24hStats(id: $market) {
    volume24h
    trades24h
  }
  
  lastPrice: marketPrice(id: $market) {
    lastPrice
  }
}
```

3. **Use Variables** for dynamic values:
```graphql
query GetUserData($user: String!, $market: String!) {
  orders: activeOrders(where: { trader: $user, market: $market }) {
    items { ... }
  }
  
  balances: balances(where: { user: $user, market: $market }) {
    items { ... }
  }
}
```

4. **Limit Results** to improve performance:
```graphql
trades(limit: 100) {
  items { ... }
}
```