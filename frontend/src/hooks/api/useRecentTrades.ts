import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { gql } from 'graphql-request';
import type { PaginatedResponse } from '@/graphql/types';
import { formatUnits } from 'viem';

// Query for recent trades
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

export interface RecentTrade {
  id: string;
  price: number;
  amount: number;
  timestamp: number;
  side: 'buy' | 'sell';
  total: number;
}

function transformTrade(trade: {
  id: string;
  price: string;
  amount: string;
  timestamp: number;
  buyer?: { address?: string };
  seller?: { address?: string };
  taker: string;
}): RecentTrade {
  const price = Number(formatUnits(BigInt(trade.price), 18));
  const amount = Number(formatUnits(BigInt(trade.amount), 18));
  const total = price * amount;
  
  // Determine side based on taker
  // If taker is buyer, it's a buy trade (taker bought from maker)
  const takerAddress = trade.taker.toLowerCase();
  const buyerAddress = trade.buyer?.address?.toLowerCase() || '';
  const side = takerAddress === buyerAddress ? 'buy' : 'sell';
  
  return {
    id: trade.id,
    price,
    amount,
    timestamp: trade.timestamp * 1000, // Convert to milliseconds
    side,
    total,
  };
}

export function useRecentTrades(marketAddress: string) {
  const query = useQuery({
    queryKey: ['recentTrades', marketAddress],
    queryFn: async () => {
      if (!marketAddress) return [];
      
      const response = await gqlClient.request<{
        trades: PaginatedResponse<{
          id: string;
          price: string;
          amount: string;
          timestamp: number;
          buyer?: { address?: string };
          seller?: { address?: string };
          taker: string;
        }>;
      }>(GET_RECENT_TRADES, {
        market: marketAddress.toLowerCase(),
        limit: 50,
      });
      
      return response.trades.items.map(transformTrade);
    },
    enabled: !!marketAddress,
    refetchInterval: 2000, // Poll every 2 seconds for live updates
  });
  
  return {
    trades: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook for aggregated 24h market stats
const GET_MARKET_STATS = gql`
  query GetMarketStats($market: String!) {
    market24hStatss(where: { market: $market }, limit: 1) {
      items {
        volume24h
        trades24h
        high24h
        low24h
        lastUpdate
      }
    }
    marketPrices(where: { market: $market }, limit: 1) {
      items {
        lastPrice
        priceChange24h
        priceChange1h
      }
    }
  }
`;

export interface MarketStats {
  volume24h: number;
  trades24h: number;
  high24h: number;
  low24h: number;
  lastPrice: number;
  priceChange24h: number;
  priceChange1h: number;
}

export function useMarketStats(marketAddress: string) {
  const query = useQuery({
    queryKey: ['marketStats', marketAddress],
    queryFn: async () => {
      if (!marketAddress) return null;
      
      try {
        // First, try to get stats from the indexer
        const response = await gqlClient.request<{
          market24hStatss: {
            items: Array<{
              volume24h: string;
              trades24h: number;
              high24h: string;
              low24h: string;
              lastUpdate: number;
            }>;
          };
          marketPrices: {
            items: Array<{
              lastPrice: string;
              priceChange24h?: string | null;
              priceChange1h?: string | null;
            }>;
          };
        }>(GET_MARKET_STATS, {
          market: marketAddress.toLowerCase(),
        });
        
        const stats = response.market24hStatss?.items?.[0];
        const price = response.marketPrices?.items?.[0];
        
        // If we have stats from indexer, format and return them
        if (stats && price) {
          return {
            volume24h: Number(formatUnits(BigInt(stats.volume24h), 18)),
            trades24h: stats.trades24h,
            high24h: Number(formatUnits(BigInt(stats.high24h), 18)),
            low24h: Number(formatUnits(BigInt(stats.low24h), 18)),
            lastPrice: Number(formatUnits(BigInt(price.lastPrice), 18)),
            priceChange24h: price.priceChange24h ? Number(price.priceChange24h) / 100 : 0, // Convert from basis points
            priceChange1h: price.priceChange1h ? Number(price.priceChange1h) / 100 : 0, // Convert from basis points
          } as MarketStats;
        }
        
        // Fallback: get recent trades and calculate stats
        const tradesResponse = await gqlClient.request<{
          trades: PaginatedResponse<{
            id: string;
            price: string;
            amount: string;
            timestamp: number;
            buyer?: { address?: string };
            seller?: { address?: string };
            taker: string;
          }>;
        }>(GET_RECENT_TRADES, {
          market: marketAddress.toLowerCase(),
          limit: 100,
        });
        
        const trades = tradesResponse.trades.items.map(transformTrade);
        
        if (!trades || trades.length === 0) {
          return {
            volume24h: 0,
            trades24h: 0,
            high24h: 0,
            low24h: 0,
            lastPrice: 0,
            priceChange24h: 0,
            priceChange1h: 0,
          } as MarketStats;
        }
        
        // Calculate stats from trades
        const prices = trades.map(t => t.price);
        const lastPrice = trades[0]?.price || 0;
        const high24h = prices.length > 0 ? Math.max(...prices) : 0;
        const low24h = prices.length > 0 ? Math.min(...prices) : 0;
        const volume24h = trades.reduce((sum, t) => sum + t.total, 0);
        const trades24h = trades.length;
        
        // Simple price change calculation
        const oldestPrice = trades[trades.length - 1]?.price || lastPrice;
        const priceChange24h = oldestPrice > 0 ? ((lastPrice - oldestPrice) / oldestPrice) * 100 : 0;
        
        return {
          volume24h,
          trades24h,
          high24h,
          low24h,
          lastPrice,
          priceChange24h,
          priceChange1h: 0,
        } as MarketStats;
      } catch (error) {
        console.error('Error fetching market stats:', error);
        // Return default values on error
        return {
          volume24h: 0,
          trades24h: 0,
          high24h: 0,
          low24h: 0,
          lastPrice: 0,
          priceChange24h: 0,
          priceChange1h: 0,
        } as MarketStats;
      }
    },
    enabled: !!marketAddress,
    refetchInterval: 10000, // Poll every 10 seconds
  });
  
  return {
    stats: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}