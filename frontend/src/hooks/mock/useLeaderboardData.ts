import { useState, useEffect } from 'react';

export interface LeaderboardTrader {
  rank: number;
  address: string;
  pnl: number;
  winRate: number;
  wins: number;
  losses: number;
  volume: number;
  totalTrades: number;
  bestTrade: number;
  isVerified: boolean;
}

export interface LeaderboardStats {
  totalTraders: number;
  totalVolume: number;
  totalTrades: number;
  avgPnL: number;
}

export interface LeaderboardData {
  traders: LeaderboardTrader[];
  stats: LeaderboardStats;
  timeframe: '24h' | '7d' | '30d' | 'all';
}

// Mock addresses for consistent demo data
const mockAddresses = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
  '0x8B3E4Aa123456789012345678901234567890123',
  '0x1234567890123456789012345678901234567890',
  '0xABCDEF1234567890123456789012345678901234',
  '0x9876543210987654321098765432109876543210',
  '0xFEDCBA0987654321098765432109876543210987',
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
  '0x3333333333333333333333333333333333333333',
  '0x4444444444444444444444444444444444444444',
];

export function useLeaderboardData(timeframe: '24h' | '7d' | '30d' | 'all') {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call or contract query
    // This would fetch leaderboard data from indexer or smart contract
    
    // Simulate API delay
    const timer = setTimeout(() => {
      // Generate mock traders
      const traders: LeaderboardTrader[] = mockAddresses.map((address, index) => {
        const totalTrades = Math.floor(Math.random() * 500) + 100;
        const wins = Math.floor(totalTrades * (0.4 + Math.random() * 0.3));
        const losses = totalTrades - wins;
        const winRate = (wins / totalTrades) * 100;
        
        // Better traders at the top
        const rankMultiplier = 1 - (index * 0.1);
        const pnl = (Math.random() * 100 * rankMultiplier) - 10;
        const volume = Math.floor((Math.random() * 1000000 + 100000) * rankMultiplier);
        const bestTrade = Math.floor(volume * 0.1 * Math.random());

        return {
          rank: index + 1,
          address,
          pnl,
          winRate,
          wins,
          losses,
          volume,
          totalTrades,
          bestTrade,
          isVerified: index < 3 || Math.random() > 0.7,
        };
      });

      // Calculate stats
      const stats: LeaderboardStats = {
        totalTraders: traders.length * 10, // Assume we're showing top 10
        totalVolume: traders.reduce((sum, t) => sum + t.volume, 0) * 10,
        totalTrades: traders.reduce((sum, t) => sum + t.totalTrades, 0) * 10,
        avgPnL: traders.reduce((sum, t) => sum + t.pnl, 0) / traders.length,
      };

      setData({ traders, stats, timeframe });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [timeframe]);

  return { data, loading };
}