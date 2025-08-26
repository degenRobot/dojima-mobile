import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { GET_USER_ORDERS, GET_OPEN_ORDERS } from '@/graphql/queries/orderHistory';
import type { OrderHistory, PaginatedResponse } from '@/graphql/types';
import { formatUnits } from 'viem';
import { useAccount } from 'wagmi';

export interface TransformedOrder {
  id: string;
  orderId: string;
  pair: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price: number;
  amount: number;
  filled: number;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  timestamp: number;
  marketAddress: string;
}

// Transform GraphQL order to frontend format
function transformOrder(order: OrderHistory): TransformedOrder {
  try {
    const price = Number(formatUnits(BigInt(order.price), 18));
    const amount = Number(formatUnits(BigInt(order.originalAmount), 18));
    const filled = Number(formatUnits(BigInt(order.filledAmount), 18));
  
  let status: TransformedOrder['status'] = 'open';
  if (order.status === 'FILLED') status = 'filled';
  else if (order.status === 'PARTIALLY_FILLED') status = 'partial';
  else if (order.status === 'CANCELLED') status = 'cancelled';
  
  // Handle market as either string or object
  let marketAddress = '';
  let pair = 'WETH/USDC'; // Default
  if (typeof order.market === 'string') {
    marketAddress = order.market;
  } else if (order.market && typeof order.market === 'object') {
    marketAddress = order.market.address;
    // Construct pair name from tokens if available
    if (order.market.baseToken && order.market.quoteToken) {
      // Extract token symbols (assuming standard naming)
      pair = `${order.market.baseToken}/${order.market.quoteToken}`;
    }
  }
  
  return {
    id: order.id,
    orderId: order.orderId,
    pair,
    side: order.isBuy ? 'buy' : 'sell',
    type: order.orderType === 'LIMIT' ? 'limit' : 'market',
    price,
    amount,
    filled,
    status,
    timestamp: order.createdAt * 1000, // Convert to milliseconds
    marketAddress,
  };
  } catch (error) {
    throw error;
  }
}

export function useOrderHistory(marketAddress?: string, status?: string) {
  const { address } = useAccount();
  
  const query = useQuery({
    queryKey: ['orderHistory', address, marketAddress, status],
    queryFn: async () => {
      if (!address) {
        console.log('[useOrderHistory] No address, returning empty array');
        return [];
      }
      
      const variables = {
        trader: address.toLowerCase(),
        limit: 100,
      };
      
      try {
        const response = await gqlClient.request<{
          orderHistorys: PaginatedResponse<OrderHistory>;
        }>(GET_USER_ORDERS, variables);
        
        const transformed = response.orderHistorys.items.map((order) => {
          try {
            return transformOrder(order);
          } catch (err) {
            throw err;
          }
        });
        return transformed;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!address,
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  return {
    orders: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useOpenOrders(marketAddress?: string) {
  const { address } = useAccount();
  
  const query = useQuery({
    queryKey: ['openOrders', address, marketAddress],
    queryFn: async () => {
      if (!address) {
        console.log('[useOpenOrders] No address, returning empty array');
        return [];
      }
      
      const variables = {
        trader: address.toLowerCase(),
      };
      
      try {
        const response = await gqlClient.request<{
          orderHistorys: PaginatedResponse<OrderHistory>;
        }>(GET_OPEN_ORDERS, variables);
        
        const transformed = response.orderHistorys.items.map((order) => {
          try {
            return transformOrder(order);
          } catch (err) {
            throw err;
          }
        });
        return transformed;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!address,
    refetchInterval: 2000, // Poll every 2 seconds for open orders
  });
  
  return {
    orders: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    totalCount: query.data?.length || 0,
  };
}