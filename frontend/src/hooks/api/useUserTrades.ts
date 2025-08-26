import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { GET_USER_TRADES } from '@/graphql/queries/tradeHistory';
import { formatUnits } from 'viem';
import { useAccount } from 'wagmi';

export interface UserTrade {
  id: string;
  orderId: string;
  pair: string;
  side: 'buy' | 'sell';
  role: 'maker' | 'taker';
  price: number;
  amount: number;
  total: number;
  fee: number;
  timestamp: number;
  marketAddress: string;
}

function transformUserTrade(trade: {
  id: string;
  orderId: string;
  market: {
    address: string;
    name?: string;
    baseToken?: string;
    quoteToken?: string;
  };
  side: 'BUY' | 'SELL';
  role: 'MAKER' | 'TAKER';
  price: string;
  amount: string;
  fee: string;
  timestamp: number;
}): UserTrade {
  const price = Number(formatUnits(BigInt(trade.price), 18));
  const amount = Number(formatUnits(BigInt(trade.amount), 18));
  const fee = Number(formatUnits(BigInt(trade.fee), 18));
  const total = price * amount;
  
  // Construct pair name from market data
  let pair = 'WETH/USDC'; // Default
  if (trade.market.baseToken && trade.market.quoteToken) {
    // Extract token symbols from addresses or use defaults
    pair = `${trade.market.baseToken === 'WETH' ? 'WETH' : 'WETH'}/${trade.market.quoteToken === 'USDC' ? 'USDC' : 'USDC'}`;
  } else if (trade.market.name) {
    pair = trade.market.name;
  }
  
  return {
    id: trade.id,
    orderId: trade.orderId,
    pair,
    side: trade.side.toLowerCase() as 'buy' | 'sell',
    role: trade.role.toLowerCase() as 'maker' | 'taker',
    price,
    amount,
    total,
    fee,
    timestamp: trade.timestamp * 1000, // Convert to milliseconds
    marketAddress: trade.market.address,
  };
}

export function useUserTrades(marketAddress?: string) {
  const { address } = useAccount();
  
  const query = useQuery({
    queryKey: ['userTrades', address, marketAddress],
    queryFn: async () => {
      if (!address) return [];
      
      const variables: Record<string, string | number> = {
        trader: address.toLowerCase(),
        limit: 100,
      };
      
      if (marketAddress) {
        variables.market = marketAddress.toLowerCase();
      }
      
      const response = await gqlClient.request<{
        userTrades: {
          items: Array<{
            id: string;
            orderId: string;
            market: {
              address: string;
              name?: string;
              baseToken?: string;
              quoteToken?: string;
            };
            side: 'BUY' | 'SELL';
            role: 'MAKER' | 'TAKER';
            price: string;
            amount: string;
            fee: string;
            timestamp: number;
          }>;
        };
      }>(GET_USER_TRADES, variables);
      
      return response.userTrades.items.map(transformUserTrade);
    },
    enabled: !!address,
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  return {
    trades: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}