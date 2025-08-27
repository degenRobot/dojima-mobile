import { useQuery } from '@tanstack/react-query';
import { GraphQLClient } from 'graphql-request';
import { NETWORK_CONFIG, FEATURES } from '../config/environment';
import * as queries from '../graphql/queries';

// Create GraphQL client
const client = FEATURES.indexer && NETWORK_CONFIG.indexerUrl 
  ? new GraphQLClient(NETWORK_CONFIG.indexerUrl)
  : null;

// Generic hook for any GraphQL query
export function useIndexerQuery<T = any>(
  queryKey: string[],
  query: string,
  variables?: any,
  options?: any
) {
  return useQuery({
    queryKey: ['indexer', ...queryKey],
    queryFn: async () => {
      if (!client) {
        throw new Error('Indexer not configured');
      }
      return client.request<T>(query, variables);
    },
    enabled: !!client && FEATURES.indexer,
    ...options,
  });
}

// Specific hooks for common queries
export function useOrderBook(bookId: string) {
  return useIndexerQuery(
    ['orderBook', bookId],
    queries.GET_ORDER_BOOK_DEPTH,
    { bookId, limit: 20 }
  );
}

export function useUserOrders(userAddress?: string) {
  return useIndexerQuery(
    ['userOrders', userAddress || ''],
    queries.GET_USER_ORDERS,
    { user: userAddress },
    { enabled: !!userAddress && !!client }
  );
}

export function useUserBalances(userAddress?: string) {
  return useIndexerQuery(
    ['userBalances', userAddress || ''],
    queries.GET_USER_BALANCES,
    { user: userAddress },
    { enabled: !!userAddress && !!client }
  );
}

export function useTradingBooks() {
  return useIndexerQuery(
    ['tradingBooks'],
    queries.GET_TRADING_BOOKS,
    { active: true }
  );
}

export function useRecentTrades(bookId: string, limit = 50) {
  return useIndexerQuery(
    ['recentTrades', bookId, limit],
    queries.GET_RECENT_TRADES,
    { bookId, limit }
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
      refetchInterval: 10000, // Refresh every 10 seconds
    }
  );
}

// Helper to check if indexer is available
export function isIndexerAvailable(): boolean {
  return !!client && FEATURES.indexer;
}