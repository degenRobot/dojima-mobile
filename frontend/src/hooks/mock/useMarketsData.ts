import { useState, useEffect } from 'react';

export interface Market {
  symbol: string;
  type: 'spot' | 'perps';
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  openInterest?: number;
  isNew?: boolean;
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

// Mock market pairs
const mockMarkets: Market[] = [
  {
    symbol: 'WETH-USDC',
    type: 'spot',
    price: 2345.67,
    change24h: 2.45,
    volume24h: 12500000,
    high24h: 2389.12,
    low24h: 2301.45,
    isNew: false,
  },
  {
    symbol: 'WBTC-USDC',
    type: 'spot',
    price: 43567.89,
    change24h: -1.23,
    volume24h: 8900000,
    high24h: 44123.45,
    low24h: 43012.34,
    isNew: false,
  },
  {
    symbol: 'ETH-PERP',
    type: 'perps',
    price: 2346.12,
    change24h: 2.48,
    volume24h: 45000000,
    high24h: 2390.00,
    low24h: 2300.00,
    openInterest: 23000000,
    isNew: false,
  },
  {
    symbol: 'BTC-PERP',
    type: 'perps',
    price: 43575.00,
    change24h: -1.20,
    volume24h: 67000000,
    high24h: 44200.00,
    low24h: 43000.00,
    openInterest: 45000000,
    isNew: false,
  },
  {
    symbol: 'SOL-USDC',
    type: 'spot',
    price: 98.76,
    change24h: 5.67,
    volume24h: 3400000,
    high24h: 99.45,
    low24h: 93.21,
    isNew: true,
  },
  {
    symbol: 'MATIC-USDC',
    type: 'spot',
    price: 0.8765,
    change24h: -3.45,
    volume24h: 1200000,
    high24h: 0.9123,
    low24h: 0.8654,
    isNew: false,
  },
  {
    symbol: 'LINK-USDC',
    type: 'spot',
    price: 14.32,
    change24h: 1.23,
    volume24h: 890000,
    high24h: 14.56,
    low24h: 14.01,
    isNew: false,
  },
  {
    symbol: 'ARB-USDC',
    type: 'spot',
    price: 1.234,
    change24h: 8.91,
    volume24h: 2300000,
    high24h: 1.245,
    low24h: 1.123,
    isNew: true,
  },
  {
    symbol: 'OP-USDC',
    type: 'spot',
    price: 2.345,
    change24h: -2.34,
    volume24h: 1500000,
    high24h: 2.456,
    low24h: 2.234,
    isNew: false,
  },
  {
    symbol: 'SOL-PERP',
    type: 'perps',
    price: 98.80,
    change24h: 5.70,
    volume24h: 12000000,
    high24h: 99.50,
    low24h: 93.25,
    openInterest: 8000000,
    isNew: true,
  },
];

export function useMarketsData() {
  const [data, setData] = useState<MarketsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call or contract query
    // This would fetch market data from indexer or price oracles
    
    // Simulate API delay
    const timer = setTimeout(() => {
      // Add some randomness to prices to simulate real market
      const markets = mockMarkets.map(market => ({
        ...market,
        price: market.price * (0.99 + Math.random() * 0.02), // ±1% price variation
        volume24h: market.volume24h * (0.8 + Math.random() * 0.4), // ±20% volume variation
      }));

      // Calculate stats
      const stats: MarketStats = {
        totalMarkets: markets.length,
        total24hVolume: markets.reduce((sum, m) => sum + m.volume24h, 0),
        totalOpenInterest: markets
          .filter(m => m.type === 'perps')
          .reduce((sum, m) => sum + (m.openInterest || 0), 0),
        total24hTrades: Math.floor(Math.random() * 50000 + 100000),
      };

      setData({ markets, stats });
      setLoading(false);
    }, 500);

    // Update prices every 5 seconds
    const interval = setInterval(() => {
      setData(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          markets: prev.markets.map(market => ({
            ...market,
            price: market.price * (0.998 + Math.random() * 0.004), // ±0.2% price movement
            change24h: market.change24h + (Math.random() - 0.5) * 0.1, // Small change updates
          })),
        };
      });
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return { data, loading };
}