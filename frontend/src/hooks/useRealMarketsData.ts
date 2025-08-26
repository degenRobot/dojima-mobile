import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { contracts } from '@/contracts/contracts';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';

export interface Market {
  symbol: string;
  type: 'spot' | 'perps';
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  openInterest?: number;
  isNew: boolean;
}

export interface MarketStats {
  totalMarkets: number;
  total24hVolume: number;
  totalOpenInterest: number;
  total24hTrades: number;
}

export interface MarketsData {
  markets: Market[];
  stats: MarketStats;
}

// Query to get market stats
const GET_MARKET_STATS = `
  query GetMarketStats {
    market24hStat(market: "${contracts.EnhancedSpotBook.address.toLowerCase()}") {
      volume24h
      high24h
      low24h
      tradesCount24h
    }
  }
`;

export function useRealMarketsData() {
  const { midPrice } = useSimpleCLOB();
  const [data, setData] = useState<MarketsData | null>(null);
  
  const { data: statsData, isLoading, error } = useQuery({
    queryKey: ['marketStats'],
    queryFn: async () => {
      const response = await gqlClient.request<{
        market24hStat: {
          volume24h: string;
          high24h: string;
          low24h: string;
          tradesCount24h: number;
        } | null;
      }>(GET_MARKET_STATS);
      
      return response.market24hStat;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  useEffect(() => {
    // For now, we only have one market (WETH-USDC)
    // In the future, this should query all markets from the registry
    
    const currentPrice = parseFloat(midPrice) || 3000; // Default to $3000 if no price
    const volume24h = statsData ? parseFloat(statsData.volume24h) / 1e18 : 0;
    const high24h = statsData ? parseFloat(statsData.high24h) / 1e18 : currentPrice;
    const low24h = statsData ? parseFloat(statsData.low24h) / 1e18 : currentPrice;
    const tradesCount = statsData?.tradesCount24h || 0;
    
    // Calculate 24h change (would need historical data - for now use 0)
    const change24h = 0;
    
    const markets: Market[] = [
      {
        symbol: 'WETH-USDC',
        type: 'spot',
        price: currentPrice,
        change24h,
        volume24h: volume24h * currentPrice, // Convert to USD value
        high24h,
        low24h,
        isNew: false,
      },
    ];
    
    const stats: MarketStats = {
      totalMarkets: 1,
      total24hVolume: volume24h * currentPrice,
      totalOpenInterest: 0, // Not applicable for spot markets
      total24hTrades: tradesCount,
    };
    
    setData({ markets, stats });
  }, [statsData, midPrice]);

  return { 
    data, 
    loading: isLoading,
    error,
    refetch: () => {
      // Refetch is handled by React Query
    }
  };
}