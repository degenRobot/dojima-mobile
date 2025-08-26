import { useEffect, useState } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { contracts } from '@/contracts/contracts';
import { formatEther } from 'viem';

export interface Trade {
  buyer: string;
  seller: string;
  price: string;
  amount: string;
  isBuyOrder: boolean;
  timestamp: number;
}

export function useSimpleCLOBEvents() {
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const { contractEvents } = useWebSocket();

  useEffect(() => {
    // Filter for EnhancedSpotBook OrderExecuted events
    const clobEvents = contractEvents.filter(
      event => 
        event.address?.toLowerCase() === contracts.EnhancedSpotBook?.address?.toLowerCase() &&
        event.eventName === 'OrderExecuted'
    );

    // Convert to Trade format
    const trades = clobEvents.map(event => ({
      buyer: event.args?.buyer as string || '',
      seller: event.args?.seller as string || '',
      price: event.args?.price ? formatEther(event.args.price as bigint) : '0',
      amount: event.args?.amount ? formatEther(event.args.amount as bigint) : '0',
      isBuyOrder: event.args?.isBuyOrder as boolean || false,
      timestamp: event.timestamp?.getTime() || Date.now(),
    }));

    // Keep only last 20 trades
    setRecentTrades(trades.slice(-20).reverse());
  }, [contractEvents]);

  return {
    recentTrades,
  };
}