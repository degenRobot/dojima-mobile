// GraphQL type definitions based on Ponder schema

export interface PaginatedResponse<T> {
  items: T[];
  pageInfo?: {
    hasNextPage: boolean;
    endCursor: string;
  };
  totalCount: number;
}

export interface Market {
  address: string;
  pairId: string;
  type: string;
  baseToken: string;
  quoteToken: string;
  name: string;
  deployedAt: number;
  isActive: boolean;
}

export interface ActiveOrder {
  id: string;
  market: string;
  orderId: string;
  trader: {
    address: string;
  };
  isBuy: boolean;
  price: string;
  originalAmount: string;
  remainingAmount: string;
  timestamp: number;
}

export interface PriceLevel {
  id: string;
  market: string;
  price: string;
  isBuy: boolean;
  totalAmount: string;
  orderCount: number;
  lastUpdate: number;
}

export interface Trade {
  id: string;
  market: string;
  buyOrderId: string;
  sellOrderId: string;
  buyer: string;
  seller: string;
  maker: string;
  taker: string;
  price: string;
  amount: string;
  quoteVolume: string;
  makerFee: string;
  takerFee: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface OrderHistory {
  id: string;
  market: string | { address: string; name: string; baseToken: string; quoteToken: string };
  orderId: string;
  trader: string | { address: string };
  isBuy: boolean;
  orderType: string;
  price: string;
  originalAmount: string;
  filledAmount: string;
  status: 'ACTIVE' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
  cancelledAt?: number;
  filledAt?: number;
}

export interface UserTrade {
  id: string;
  trader: string;
  market: string | { address: string; name: string };
  orderId: string;
  side: 'BUY' | 'SELL';
  role: 'MAKER' | 'TAKER';
  price: string;
  amount: string;
  quoteAmount: string;
  fee: string;
  timestamp: number;
}

export interface MarketPrice {
  market: string;
  lastPrice: string;
  lastTradeId: string;
  lastTradeTimestamp: number;
  priceChange24h?: string;
  priceChange1h?: string;
}

export interface Market24hStats {
  market: string;
  volume24h: string;
  trades24h: number;
  high24h: string;
  low24h: string;
  lastUpdate: number;
}

export interface PriceCandle {
  id: string;
  market: string;
  interval: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
}

export interface HourlyVolume {
  id: string;
  market: string;
  hourTimestamp: number;
  volume: string;
  trades: number;
  high: string;
  low: string;
  open: string;
  close: string;
}