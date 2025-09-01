import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketManager, ConnectionState } from '../lib/websocket/WebSocketManager';
import { NETWORK_CONFIG } from '../config/contracts';
import { logInfo, logError } from '../utils/logger';

interface WebSocketContextValue {
  wsManager: WebSocketManager | null;
  connectionState: ConnectionState;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  wsManager: null,
  connectionState: 'disconnected',
  connect: () => {},
  disconnect: () => {},
});

export const useWebSocketContext = () => useContext(WebSocketContext);

interface RealtimeProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

export function RealtimeProvider({ 
  children, 
  autoConnect = false 
}: RealtimeProviderProps) {
  const [wsManager] = useState(() => new WebSocketManager());
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = wsManager.onStateChange((state) => {
      setConnectionState(state);
      logInfo('RealtimeProvider', 'Connection state changed', { state });
    });

    // Auto-connect if enabled
    if (autoConnect && NETWORK_CONFIG.wsUrl) {
      wsManager.connect(NETWORK_CONFIG.wsUrl);
    }

    return () => {
      unsubscribe();
      wsManager.disconnect();
    };
  }, [wsManager, autoConnect]);

  const connect = () => {
    if (NETWORK_CONFIG.wsUrl) {
      wsManager.connect(NETWORK_CONFIG.wsUrl);
    } else {
      logError('RealtimeProvider', 'No WebSocket URL configured');
    }
  };

  const disconnect = () => {
    wsManager.disconnect();
  };

  return (
    <WebSocketContext.Provider 
      value={{ 
        wsManager, 
        connectionState,
        connect,
        disconnect,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook for real-time order book updates
export function useRealtimeOrderBook(bookId: string) {
  const { wsManager } = useWebSocketContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!wsManager || !bookId) return;

    const unsubscribe = wsManager.subscribe(
      `orderBook:${bookId}`,
      (update: any) => {
        // Update React Query cache
        queryClient.setQueryData(
          ['indexer', 'orderBook', bookId],
          (old: any) => {
            if (!old) return old;
            
            // Merge the update with existing data
            // This is a simplified version - you'd want more sophisticated merging
            return {
              ...old,
              buyOrders: update.type === 'orderPlaced' && update.order.orderType === 'BUY'
                ? { items: [...(old.buyOrders?.items || []), update.order] }
                : old.buyOrders,
              sellOrders: update.type === 'orderPlaced' && update.order.orderType === 'SELL'
                ? { items: [...(old.sellOrders?.items || []), update.order] }
                : old.sellOrders,
            };
          }
        );
        
        logInfo('useRealtimeOrderBook', 'Order book updated', { bookId, update });
      }
    );

    return unsubscribe;
  }, [wsManager, bookId, queryClient]);
}

// Hook for real-time trades
export function useRealtimeTrades(bookId: string) {
  const { wsManager } = useWebSocketContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!wsManager || !bookId) return;

    const unsubscribe = wsManager.subscribe(
      `trades:${bookId}`,
      (trade: any) => {
        // Prepend new trade to list
        queryClient.setQueryData(
          ['indexer', 'recentTrades', bookId, '20'],
          (old: any) => {
            if (!old) return old;
            
            return {
              ...old,
              items: [trade, ...(old.items || [])].slice(0, 20),
            };
          }
        );
        
        logInfo('useRealtimeTrades', 'New trade', { bookId, trade });
      }
    );

    return unsubscribe;
  }, [wsManager, bookId, queryClient]);
}

// Hook for user-specific updates
export function useRealtimeUserUpdates(userAddress?: string) {
  const { wsManager } = useWebSocketContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!wsManager || !userAddress) return;

    const unsubscribe = wsManager.subscribe(
      `user:${userAddress}`,
      (update: any) => {
        // Handle different types of user updates
        switch (update.type) {
          case 'orderUpdate':
            queryClient.invalidateQueries({ queryKey: ['indexer', 'userOrders'] });
            break;
          case 'balanceUpdate':
            queryClient.invalidateQueries({ queryKey: ['indexer', 'userBalances'] });
            break;
          case 'tradeExecuted':
            queryClient.invalidateQueries({ queryKey: ['indexer', 'userTrades'] });
            break;
        }
        
        logInfo('useRealtimeUserUpdates', 'User update received', { userAddress, update });
      }
    );

    return unsubscribe;
  }, [wsManager, userAddress, queryClient]);
}

// Hook for market statistics
export function useRealtimeMarketStats(bookId: string) {
  const { wsManager } = useWebSocketContext();
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!wsManager || !bookId) return;

    const unsubscribe = wsManager.subscribe(
      `market:${bookId}`,
      (update: any) => {
        setStats(update);
        
        // Also update React Query cache
        queryClient.setQueryData(
          ['indexer', 'marketStats', bookId, '24h'],
          (old: any) => ({
            ...old,
            ...update,
          })
        );
        
        logInfo('useRealtimeMarketStats', 'Market stats updated', { bookId, update });
      }
    );

    return unsubscribe;
  }, [wsManager, bookId, queryClient]);

  return stats;
}