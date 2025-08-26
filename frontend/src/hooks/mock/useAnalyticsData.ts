import { useState, useEffect } from 'react';

export interface TopPair {
  symbol: string;
  volume: number;
  trades: number;
  fees: number;
  liquidity: number;
  apr: number;
}

export interface AnalyticsData {
  tvl: number;
  tvlChange: number;
  volume: number;
  volumeChange: number;
  fees: number;
  feeAPR: number;
  activeUsers: number;
  userChange: number;
  topPairs: TopPair[];
  timeframe: '24h' | '7d' | '30d';
}

const basePairs: Omit<TopPair, 'volume' | 'trades' | 'fees'>[] = [
  { symbol: 'WETH-USDC', liquidity: 25000000, apr: 24.5 },
  { symbol: 'WBTC-USDC', liquidity: 18000000, apr: 18.2 },
  { symbol: 'ETH-PERP', liquidity: 45000000, apr: 35.8 },
  { symbol: 'BTC-PERP', liquidity: 62000000, apr: 42.3 },
  { symbol: 'SOL-USDC', liquidity: 8000000, apr: 15.6 },
  { symbol: 'MATIC-USDC', liquidity: 3500000, apr: 12.4 },
  { symbol: 'LINK-USDC', liquidity: 2800000, apr: 10.8 },
  { symbol: 'ARB-USDC', liquidity: 5200000, apr: 28.9 },
];

export function useAnalyticsData(timeframe: '24h' | '7d' | '30d') {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call or contract query
    // This would fetch analytics data from indexer or aggregated on-chain data
    
    // Simulate API delay
    const timer = setTimeout(() => {
      // Generate data based on timeframe
      const multiplier = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
      
      // Generate top pairs with volume based on timeframe
      const topPairs: TopPair[] = basePairs.map(pair => {
        const baseVolume = pair.liquidity * 0.5 * Math.random();
        const baseTrades = Math.floor(Math.random() * 1000 + 500);
        
        return {
          ...pair,
          volume: Math.floor(baseVolume * multiplier),
          trades: Math.floor(baseTrades * multiplier),
          fees: Math.floor(baseVolume * multiplier * 0.0003), // 0.03% fee
        };
      }).sort((a, b) => b.volume - a.volume);

      // Calculate totals
      const totalVolume = topPairs.reduce((sum, p) => sum + p.volume, 0);
      const totalFees = topPairs.reduce((sum, p) => sum + p.fees, 0);
      const totalLiquidity = topPairs.reduce((sum, p) => sum + p.liquidity, 0);

      const analyticsData: AnalyticsData = {
        tvl: totalLiquidity,
        tvlChange: (Math.random() - 0.5) * 20, // -10% to +10%
        volume: totalVolume,
        volumeChange: (Math.random() - 0.3) * 30, // Slightly positive bias
        fees: totalFees,
        feeAPR: (totalFees * 365 / multiplier) / totalLiquidity * 100,
        activeUsers: Math.floor(Math.random() * 5000 + 10000),
        userChange: (Math.random() - 0.2) * 25, // Slightly positive bias
        topPairs,
        timeframe,
      };

      setData(analyticsData);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [timeframe]);

  return { data, loading };
}