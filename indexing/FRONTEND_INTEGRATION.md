# Frontend Integration Guide for CLOB Indexer

This guide explains how to integrate the CLOB indexer GraphQL API into your frontend application.

## Overview

The indexer provides a GraphQL API at `http://localhost:42069` (development) that serves real-time blockchain data for the CLOB. The frontend uses `graphql-request` to query this data.

## Setup

### 1. Install Dependencies

```bash
npm install graphql-request graphql
```

### 2. Configure GraphQL Client

Create a GraphQL client instance:

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

### 3. Define TypeScript Types

```typescript
// src/graphql/types.ts
export interface OrderHistory {
  id: string;
  market: string | { address: string; name: string };
  orderId: string;
  trader: string | { address: string };
  isBuy: boolean;
  orderType: string;
  price: string;
  originalAmount: string;
  filledAmount: string;
  status: 'ACTIVE' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  price: string;
  amount: string;
  timestamp: number;
  buyer: { address: string };
  seller: { address: string };
  taker: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pageInfo?: {
    hasNextPage: boolean;
    endCursor: string;
  };
  totalCount: number;
}
```

## Common Queries

### 1. Order Book

```typescript
const GET_ORDER_BOOK = gql`
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
`;
```

### 2. User Order History

```typescript
const GET_USER_ORDERS = gql`
  query GetUserOrders($trader: String!, $limit: Int = 50) {
    orderHistorys(
      where: { trader: $trader }
      orderBy: "createdAt"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        orderId
        isBuy
        orderType
        price
        originalAmount
        filledAmount
        status
        createdAt
      }
    }
  }
`;
```

### 3. Recent Trades

```typescript
const GET_RECENT_TRADES = gql`
  query GetRecentTrades($market: String!, $limit: Int = 20) {
    trades(
      where: { market: $market }
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
        taker
      }
    }
  }
`;
```

### 4. Market Statistics

```typescript
const GET_MARKET_STATS = gql`
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
`;
```

## React Hooks Implementation

### 1. Order Book Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';

export function useOrderBook(marketAddress: string) {
  const query = useQuery({
    queryKey: ['orderBook', marketAddress],
    queryFn: async () => {
      const response = await gqlClient.request(GET_ORDER_BOOK, {
        market: marketAddress.toLowerCase(),
      });
      
      // Transform BigInt strings to numbers
      const transformOrders = (orders: any[]) => 
        orders.map(order => ({
          ...order,
          price: Number(formatUnits(BigInt(order.price), 18)),
          remainingAmount: Number(formatUnits(BigInt(order.remainingAmount), 18)),
        }));
      
      return {
        buyOrders: transformOrders(response.buyOrders.items),
        sellOrders: transformOrders(response.sellOrders.items),
      };
    },
    enabled: !!marketAddress,
    refetchInterval: 2000, // Poll every 2 seconds
  });
  
  return {
    buyOrders: query.data?.buyOrders || [],
    sellOrders: query.data?.sellOrders || [],
    loading: query.isLoading,
    error: query.error,
  };
}
```

### 2. User Orders Hook

```typescript
export function useUserOrders(userAddress?: string) {
  const query = useQuery({
    queryKey: ['userOrders', userAddress],
    queryFn: async () => {
      if (!userAddress) return [];
      
      const response = await gqlClient.request(GET_USER_ORDERS, {
        trader: userAddress.toLowerCase(),
      });
      
      return response.orderHistorys.items.map(transformOrder);
    },
    enabled: !!userAddress,
    refetchInterval: 5000,
  });
  
  return {
    orders: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

### 3. Recent Trades Hook

```typescript
export function useRecentTrades(marketAddress: string) {
  const query = useQuery({
    queryKey: ['recentTrades', marketAddress],
    queryFn: async () => {
      const response = await gqlClient.request(GET_RECENT_TRADES, {
        market: marketAddress.toLowerCase(),
      });
      
      return response.trades.items.map((trade: any) => ({
        ...trade,
        price: Number(formatUnits(BigInt(trade.price), 18)),
        amount: Number(formatUnits(BigInt(trade.amount), 18)),
        side: trade.taker === trade.buyer.address ? 'buy' : 'sell',
      }));
    },
    enabled: !!marketAddress,
    refetchInterval: 2000,
  });
  
  return {
    trades: query.data || [],
    loading: query.isLoading,
    error: query.error,
  };
}
```

## Important Considerations

### 1. Relation Fields

In Ponder v0.11, relation fields are objects, not strings. Always specify subfields:

```typescript
// ❌ Wrong
trader

// ✅ Correct
trader {
  address
}
```

### 2. BigInt Handling

All numeric values (prices, amounts) are stored as BigInt strings. Convert them for display:

```typescript
import { formatUnits } from 'viem';

// Convert price from wei (18 decimals)
const displayPrice = Number(formatUnits(BigInt(order.price), 18));

// Convert USDC amount (6 decimals)
const usdcAmount = Number(formatUnits(BigInt(order.amount), 6));
```

### 3. Address Formatting

Always lowercase addresses when querying:

```typescript
const response = await gqlClient.request(query, {
  trader: userAddress.toLowerCase(),
  market: marketAddress.toLowerCase(),
});
```

### 4. Polling vs WebSocket

Currently using polling for real-time updates. Consider these intervals:
- Order book: 2 seconds
- User orders: 5 seconds
- Recent trades: 2 seconds
- Market stats: 10 seconds

### 5. Error Handling

```typescript
const query = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  retry: 3,
  retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  onError: (error) => {
    console.error('Query failed:', error);
    // Show user-friendly error message
  },
});
```

## Optimizations

### 1. Query Batching

Combine related queries to reduce network requests:

```typescript
const GET_TRADING_DATA = gql`
  query GetTradingData($market: String!, $trader: String) {
    orderBook: activeOrders(where: { market: $market }, limit: 20) {
      items { ... }
    }
    recentTrades: trades(where: { market: $market }, limit: 10) {
      items { ... }
    }
    userOrders: orderHistorys(where: { trader: $trader }, limit: 10) {
      items { ... }
    }
  }
`;
```

### 2. Caching Strategy

Use React Query's caching:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000, // Data is fresh for 1 second
      cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
    },
  },
});
```

### 3. Pagination

For large datasets:

```typescript
const GET_PAGINATED_ORDERS = gql`
  query GetOrders($after: String, $limit: Int = 20) {
    orderHistorys(after: $after, limit: $limit) {
      items { ... }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// In your hook
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['orders'],
  queryFn: ({ pageParam = null }) => 
    gqlClient.request(GET_PAGINATED_ORDERS, { after: pageParam }),
  getNextPageParam: (lastPage) => 
    lastPage.orderHistorys.pageInfo.hasNextPage 
      ? lastPage.orderHistorys.pageInfo.endCursor 
      : undefined,
});
```

## Environment Configuration

### Development

```env
NEXT_PUBLIC_INDEXER_URL=http://localhost:42069
```

### Production

```env
NEXT_PUBLIC_INDEXER_URL=https://indexer.yourdomain.com
```

## Testing Integration

Test your queries in the GraphQL playground:

1. Navigate to `http://localhost:42069` (if playground is enabled)
2. Or use the test script:

```bash
cd indexing
npm test
```

## Common Issues

### 1. CORS Errors

If you encounter CORS issues, ensure the indexer is configured to accept requests from your frontend domain.

### 2. Connection Refused

- Check indexer is running: `cd indexing && npm run dev`
- Verify correct URL in environment variables
- Check firewall/network settings

### 3. Query Errors

- Verify field names match schema exactly
- Check relation fields have subfield selections
- Ensure addresses are lowercase

### 4. Performance Issues

- Reduce polling frequency for less critical data
- Implement pagination for large lists
- Use field selection to query only needed data

## Example Component

```typescript
import { useOrderBook, useRecentTrades, useMarketStats } from '@/hooks/api';

export function TradingView({ marketAddress }: { marketAddress: string }) {
  const { buyOrders, sellOrders, loading: ordersLoading } = useOrderBook(marketAddress);
  const { trades, loading: tradesLoading } = useRecentTrades(marketAddress);
  const { stats, loading: statsLoading } = useMarketStats(marketAddress);
  
  if (ordersLoading || tradesLoading || statsLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <div>
      <MarketStats stats={stats} />
      <OrderBook buyOrders={buyOrders} sellOrders={sellOrders} />
      <RecentTrades trades={trades} />
    </div>
  );
}
```

## Next Steps

1. Implement WebSocket subscriptions for real-time updates
2. Add query result caching and deduplication
3. Create data transformation utilities
4. Build error boundary components
5. Add performance monitoring