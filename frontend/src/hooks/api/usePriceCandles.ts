import { useQuery } from '@tanstack/react-query';
import { GraphQLClient } from 'graphql-request';
import { formatUnits } from 'viem';

const client = new GraphQLClient('http://localhost:42069');

export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface Trade {
  timestamp: number;
  timestampMinute: number;
  price: string;
  amount: string;
  quoteVolume: string;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const aggregateTradesToCandles = (trades: Trade[], intervalMinutes: number): Candle[] => {
  if (trades.length === 0) return [];

  const candles: Map<number, Candle> = new Map();
  const intervalSeconds = intervalMinutes * 60;

  // Sort trades by timestamp
  const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  sortedTrades.forEach(trade => {
    const candleTime = Math.floor(trade.timestamp / intervalSeconds) * intervalSeconds;
    const price = Number(formatUnits(BigInt(trade.price), 18));
    const volume = Number(formatUnits(BigInt(trade.quoteVolume), 18));

    const existingCandle = candles.get(candleTime);
    if (existingCandle) {
      existingCandle.high = Math.max(existingCandle.high, price);
      existingCandle.low = Math.min(existingCandle.low, price);
      existingCandle.close = price;
      existingCandle.volume += volume;
    } else {
      candles.set(candleTime, {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume,
      });
    }
  });

  return Array.from(candles.values()).sort((a, b) => a.time - b.time);
};

const fetchTradesForCandles = async (market: string, from: number, to: number) => {
  const query = `
    query GetTradesForCandles($market: String!, $from: Int!, $to: Int!) {
      trades(
        where: { 
          market: $market,
          timestamp_gte: $from,
          timestamp_lte: $to
        }
        orderBy: "timestamp"
        orderDirection: "asc"
        limit: 1000
      ) {
        items {
          timestamp
          timestampMinute
          price
          amount
          quoteVolume
        }
      }
    }
  `;

  const variables = {
    market: market.toLowerCase(),
    from,
    to,
  };

  try {
    const data = await client.request<{ trades: { items: Trade[] } }>(query, variables);
    return data.trades.items;
  } catch (error) {
    console.error('Error fetching trades for candles:', error);
    return [];
  }
};

// Generate mock candles for testing
const generateMockCandles = (count: number, interval: TimeInterval): Candle[] => {
  const now = Math.floor(Date.now() / 1000);
  const intervalMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  }[interval];
  const intervalSeconds = intervalMinutes * 60;
  
  const candles: Candle[] = [];
  let basePrice = 100 + Math.random() * 50;
  
  for (let i = count - 1; i >= 0; i--) {
    const time = now - (i * intervalSeconds);
    const volatility = 0.02;
    const trend = Math.random() > 0.5 ? 1 : -1;
    
    const open = basePrice;
    const close = open * (1 + (Math.random() * volatility * trend));
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.random() * 100000;
    
    candles.push({ time, open, high, low, close, volume });
    basePrice = close;
  }
  
  return candles;
};

export const usePriceCandles = (
  market: string,
  interval: TimeInterval,
  enabled = true
) => {
  const intervalMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  }[interval];

  const query = useQuery({
    queryKey: ['priceCandles', market, interval],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000);
      const candleCount = 100;
      const from = now - (intervalMinutes * 60 * candleCount);
      
      const trades = await fetchTradesForCandles(market, from, now);
      
      if (trades.length === 0) {
        // Return mock data if no trades
        return generateMockCandles(candleCount, interval);
      }
      
      return aggregateTradesToCandles(trades, intervalMinutes);
    },
    enabled: enabled && !!market,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000,
  });

  return {
    candles: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};