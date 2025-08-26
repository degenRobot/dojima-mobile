import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { GET_ACTIVE_ORDERS, GET_MARKET_PRICE, GET_MARKET_STATS } from '@/graphql/queries/orderBook';
import type { ActiveOrder, MarketPrice, Market24hStats, PaginatedResponse } from '@/graphql/types';
import { formatUnits } from 'viem';

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
  percentage: number;
  orders?: Array<{
    orderId: string;
    trader: string;
    amount: string;
  }>;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  lastPrice: number;
  lastPriceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

// Transform active orders into order book levels
function transformToOrderBook(
  orders: ActiveOrder[],
  priceData?: MarketPrice,
  statsData?: Market24hStats
): OrderBookData {
  const bids: Map<string, OrderBookLevel> = new Map();
  const asks: Map<string, OrderBookLevel> = new Map();

  // Group orders by price level
  orders.forEach(order => {
    const price = Number(formatUnits(BigInt(order.price), 18));
    const amount = Number(formatUnits(BigInt(order.remainingAmount), 18));
    const priceKey = price.toFixed(2);
    
    const map = order.isBuy ? bids : asks;
    const existing = map.get(priceKey);
    
    if (existing) {
      existing.amount += amount;
      existing.orders?.push({
        orderId: order.orderId,
        trader: order.trader.address,
        amount: amount.toFixed(6),
      });
    } else {
      map.set(priceKey, {
        price,
        amount,
        total: 0, // Will be calculated after
        percentage: 0, // Will be calculated after
        orders: [{
          orderId: order.orderId,
          trader: order.trader.address,
          amount: amount.toFixed(6),
        }],
      });
    }
  });

  // Convert to arrays and sort
  const bidArray = Array.from(bids.values()).sort((a, b) => b.price - a.price);
  const askArray = Array.from(asks.values()).sort((a, b) => a.price - b.price);

  // Calculate cumulative totals and percentages
  let bidTotal = 0;
  bidArray.forEach(level => {
    bidTotal += level.amount;
    level.total = bidTotal;
  });
  
  let askTotal = 0;
  askArray.forEach(level => {
    askTotal += level.amount;
    level.total = askTotal;
  });

  // Calculate percentages
  const maxBidTotal = bidArray[bidArray.length - 1]?.total || 0;
  const maxAskTotal = askArray[askArray.length - 1]?.total || 0;
  
  bidArray.forEach(level => {
    level.percentage = maxBidTotal > 0 ? (level.total / maxBidTotal) * 100 : 0;
  });
  
  askArray.forEach(level => {
    level.percentage = maxAskTotal > 0 ? (level.total / maxAskTotal) * 100 : 0;
  });

  // Calculate spread
  const bestBid = bidArray[0]?.price || 0;
  const bestAsk = askArray[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  // Get market data
  const lastPrice = priceData ? Number(formatUnits(BigInt(priceData.lastPrice), 18)) : 0;
  const lastPriceChange24h = priceData?.priceChange24h ? Number(priceData.priceChange24h) / 100 : 0;
  const volume24h = statsData ? Number(formatUnits(BigInt(statsData.volume24h), 18)) : 0;
  const high24h = statsData ? Number(formatUnits(BigInt(statsData.high24h), 18)) : 0;
  const low24h = statsData ? Number(formatUnits(BigInt(statsData.low24h), 18)) : 0;

  return {
    bids: bidArray,
    asks: askArray,
    spread,
    spreadPercent,
    lastPrice,
    lastPriceChange24h,
    volume24h,
    high24h,
    low24h,
  };
}

export function useOrderBook(marketAddress: string) {
  const [data, setData] = useState<OrderBookData | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Query active orders
  const ordersQuery = useQuery({
    queryKey: ['orderBook', marketAddress],
    queryFn: async () => {
      const response = await gqlClient.request<{
        activeOrders: PaginatedResponse<ActiveOrder>;
      }>(GET_ACTIVE_ORDERS, { 
        market: marketAddress.toLowerCase(),
        limit: 200 // Get more orders for better depth
      });
      
      return response.activeOrders.items;
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Query market price data
  const priceQuery = useQuery({
    queryKey: ['marketPrice', marketAddress],
    queryFn: async () => {
      const response = await gqlClient.request<{
        marketPrices: PaginatedResponse<MarketPrice>;
      }>(GET_MARKET_PRICE, { 
        market: marketAddress.toLowerCase()
      });
      
      return response.marketPrices.items[0] || null;
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Query 24h stats
  const statsQuery = useQuery({
    queryKey: ['marketStats', marketAddress],
    queryFn: async () => {
      const response = await gqlClient.request<{
        market24hStatss: PaginatedResponse<Market24hStats>;
      }>(GET_MARKET_STATS, { 
        market: marketAddress.toLowerCase()
      });
      
      return response.market24hStatss.items[0] || null;
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Transform data when queries complete
  useEffect(() => {
    // Always set data, even if empty
    const orders = ordersQuery.data || [];
    
    const transformed = transformToOrderBook(
      orders,
      priceQuery.data || undefined,
      statsQuery.data || undefined
    );
    setData(transformed);
  }, [ordersQuery.data, priceQuery.data, statsQuery.data]);
  

  // Mark initial load as complete when we have some data
  useEffect(() => {
    if (ordersQuery.data && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [ordersQuery.data, isInitialLoad]);

  return {
    data,
    loading: isInitialLoad && ordersQuery.isLoading,
    error: ordersQuery.error || (priceQuery.error && statsQuery.error),
    refetch: () => {
      ordersQuery.refetch();
      priceQuery.refetch();
      statsQuery.refetch();
    },
  };
}