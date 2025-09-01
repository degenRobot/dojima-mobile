// Trading type definitions

export interface TradingPair {
  id: number;
  base: string;
  quote: string;
  symbol: string;
  baseDecimals: number;
  quoteDecimals: number;
  description: string;
}

export interface OrderLevel {
  price: string;
  amount: string;
  total: string;
  percentage: number;
}

export interface Trade {
  id: string;
  price: string;
  amount: string;
  time: string;
  side: 'buy' | 'sell';
  buyer?: string;
  seller?: string;
  timestamp?: number;
}

export interface OrderBookData {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: string;
  spreadPercent: string;
}

export interface MarketStats {
  high: string;
  low: string;
  volume: string;
  change24h: string;
  changePercent: string;
}

export interface UserOrder {
  id: string;
  bookId: string;
  orderType: 'BUY' | 'SELL';
  price: string;
  amount: string;
  filled: string;
  remaining: string;
  status: 'ACTIVE' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';
  timestamp: number;
  txHash?: string;
}

export interface UserBalance {
  token: string;
  available: string;
  locked: string;
  totalDeposited: string;
  totalWithdrawn: string;
}