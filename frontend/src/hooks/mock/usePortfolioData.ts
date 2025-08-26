import { useState, useEffect } from 'react';

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  value: number;
  price: number;
  change24h: number;
}

export interface OpenOrder {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price: number;
  amount: number;
  filled: number;
  status: 'open' | 'partial' | 'cancelled';
  timestamp: number;
}

export interface Position {
  id: string;
  pair: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  amount: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  leverage: number;
}

export interface TradeHistory {
  id: string;
  type: 'trade' | 'deposit' | 'withdraw';
  pair?: string;
  side?: 'buy' | 'sell';
  price?: number;
  amount: number;
  value: number;
  fee?: number;
  status: 'completed' | 'pending' | 'failed';
  timestamp: number;
  txHash: string;
}

export interface PortfolioData {
  totalValue: number;
  totalValueChange24h: number;
  totalValueChange24hPercent: number;
  balances: TokenBalance[];
  openOrders: OpenOrder[];
  positions: Position[];
  history: TradeHistory[];
}

// Mock data generator
const generateMockPortfolioData = (): PortfolioData => {
  // TODO: Replace with real data from SimpleCLOB contract and indexer
  // useContractRead for balances
  // useQuery for historical data from indexer API
  
  const balances: TokenBalance[] = [
    {
      token: '0x0000000000000000000000000000000000000000', // Mock WETH address
      symbol: 'WETH',
      amount: '5.25',
      price: 2150,
      value: 5.25 * 2150,
      change24h: 2.5,
    },
    {
      token: '0x0000000000000000000000000000000000000001', // Mock USDC address
      symbol: 'USDC',
      amount: '15000',
      price: 1,
      value: 15000,
      change24h: 0,
    },
  ];

  const openOrders: OpenOrder[] = [
    {
      id: '1',
      pair: 'WETH/USDC',
      side: 'buy',
      type: 'limit',
      price: 2000,
      amount: 1,
      filled: 0,
      status: 'open',
      timestamp: Date.now() - 3600000,
    },
    {
      id: '2',
      pair: 'WETH/USDC',
      side: 'sell',
      type: 'limit',
      price: 2300,
      amount: 0.5,
      filled: 0.2,
      status: 'partial',
      timestamp: Date.now() - 7200000,
    },
  ];

  const positions: Position[] = [
    // Empty for now - will be used for perpetuals
  ];

  const history: TradeHistory[] = [
    {
      id: '1',
      type: 'trade',
      pair: 'WETH/USDC',
      side: 'buy',
      price: 2100,
      amount: 2,
      value: 4200,
      fee: 12.6,
      status: 'completed',
      timestamp: Date.now() - 86400000,
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    {
      id: '2',
      type: 'deposit',
      amount: 10000,
      value: 10000,
      status: 'completed',
      timestamp: Date.now() - 172800000,
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
  ];

  const totalValue = balances.reduce((acc, b) => acc + b.value, 0);
  const totalValueChange24h = 287.5; // Mock 24h change
  const totalValueChange24hPercent = (totalValueChange24h / (totalValue - totalValueChange24h)) * 100;

  return {
    totalValue,
    totalValueChange24h,
    totalValueChange24hPercent,
    balances,
    openOrders,
    positions,
    history,
  };
};

export function usePortfolioData() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate API call delay
    const timer = setTimeout(() => {
      try {
        setData(generateMockPortfolioData());
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // TODO: Add real-time updates via WebSocket
  // useEffect(() => {
  //   const ws = new WebSocket('wss://api.dojima.com/portfolio');
  //   ws.onmessage = (event) => {
  //     const update = JSON.parse(event.data);
  //     setData(prev => ({ ...prev, ...update }));
  //   };
  //   return () => ws.close();
  // }, []);

  return { data, loading, error, refetch: () => setData(generateMockPortfolioData()) };
}