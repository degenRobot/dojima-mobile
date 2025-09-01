import { useQuery } from '@tanstack/react-query';
import { GraphQLClient } from 'graphql-request';
import { NETWORK_CONFIG, FEATURES } from '../config/contracts';
import * as queries from '../graphql/queries';
import { retry } from '../utils/retry';
import { logError, logWarn } from '../utils/logger';

// Create GraphQL client
const client = FEATURES.indexer && NETWORK_CONFIG.indexerUrl 
  ? new GraphQLClient(NETWORK_CONFIG.indexerUrl)
  : null;

// Generic hook for any GraphQL query with error handling
export function useIndexerQuery<T = any>(
  queryKey: string[],
  query: string,
  variables?: any,
  options?: any,
  defaultData?: T // Add default data for graceful fallback
) {
  return useQuery({
    queryKey: ['indexer', ...queryKey],
    queryFn: async () => {
      if (!client) {
        logWarn('useIndexer', 'Indexer not configured, returning empty data');
        return defaultData || null;
      }
      
      try {
        return await retry(
          () => client.request<T>(query, variables),
          {
            maxAttempts: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logWarn('useIndexer', `Query retry attempt ${attempt}`, {
                query: queryKey.join('/'),
                error: error.message,
              });
            },
          }
        );
      } catch (error) {
        logError('useIndexer', 'Query failed after retries, returning empty data', {
          query: queryKey.join('/'),
          error: (error as Error).message,
          variables,
        });
        // Return default/empty data instead of throwing
        return defaultData || null;
      }
    },
    enabled: FEATURES.indexer, // Always enabled if feature is on
    retry: false, // We handle retries ourselves
    staleTime: 30000, // Consider data stale after 30 seconds
    cacheTime: 300000, // Keep cache for 5 minutes
    refetchInterval: false, // Don't auto-refetch
    ...options,
  });
}

// Specific hooks for common queries with default empty data
export function useOrderBook(bookId: string) {
  return useIndexerQuery(
    ['orderBook', bookId],
    queries.GET_ORDER_BOOK_DEPTH,
    { bookId, limit: 20 },
    {},
    { buyOrders: { items: [] }, sellOrders: { items: [] } } // Default empty order book with GraphQL structure
  );
}

export function useUserOrders(userAddress?: string) {
  return useIndexerQuery(
    ['userOrders', userAddress || ''],
    queries.GET_USER_ORDERS,
    { user: userAddress },
    { enabled: !!userAddress },
    { cLOBOrders: { items: [] } } // Default empty orders with GraphQL structure
  );
}

export function useUserBalances(userAddress?: string) {
  return useIndexerQuery(
    ['userBalances', userAddress || ''],
    queries.GET_USER_BALANCES,
    { user: userAddress },
    { enabled: !!userAddress },
    { userBalances: { items: [] } } // Default empty balances with GraphQL structure
  );
}

export function useTradingBooks() {
  return useIndexerQuery(
    ['tradingBooks'],
    queries.GET_TRADING_BOOKS,
    { active: true },
    {},
    { tradingBooks: { items: [] } } // Default empty books with GraphQL structure
  );
}

export function useRecentTrades(bookId: string, limit = 50) {
  return useIndexerQuery(
    ['recentTrades', bookId, limit.toString()],
    queries.GET_RECENT_TRADES,
    { bookId, limit },
    {},
    { trades: { items: [] } } // Default empty trades with GraphQL structure
  );
}

export function useMarketStats(bookId: string, period: '1h' | '24h' | '7d' = '24h') {
  return useIndexerQuery(
    ['marketStats', bookId, period],
    queries.GET_MARKET_STATS,
    { bookId, period }
  );
}

export function useUserDashboard(userAddress?: string) {
  return useIndexerQuery(
    ['userDashboard', userAddress || ''],
    queries.GET_USER_DASHBOARD,
    { user: userAddress },
    { 
      enabled: !!userAddress && !!client,
      refetchInterval: false, // Disable auto-refresh to prevent freezing
    }
  );
}

// Helper to check if indexer is available
export function isIndexerAvailable(): boolean {
  return !!client && FEATURES.indexer;
}