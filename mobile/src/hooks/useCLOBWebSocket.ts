import { useEffect, useState, useCallback, useRef } from 'react';
import { getCLOBWebSocketManager, CLOBWebSocketManager } from '../services/CLOBWebSocketManager';
import { useAccount } from 'wagmi';

interface OrderBookData {
  buyOrders: Array<{
    id: string;
    price: bigint;
    amount: bigint;
    remaining: bigint;
  }>;
  sellOrders: Array<{
    id: string;
    price: bigint;
    amount: bigint;
    remaining: bigint;
  }>;
  lastUpdate: number;
}

interface UseOrderBookOptions {
  bookId: number;
  autoConnect?: boolean;
}

export function useOrderBookWebSocket({ bookId, autoConnect = true }: UseOrderBookOptions) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const wsManager = useRef<CLOBWebSocketManager>();

  useEffect(() => {
    wsManager.current = getCLOBWebSocketManager();
    
    const handleOrderBookUpdate = (update: any) => {
      if (update.bookId === bookId) {
        setLastUpdate(Date.now());
        // In real implementation, fetch updated order book from indexer
        // or maintain local state
      }
    };

    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);

    // Register event handlers
    wsManager.current.on('orderBookUpdate', handleOrderBookUpdate);
    wsManager.current.on('connected', handleConnected);
    wsManager.current.on('disconnected', handleDisconnected);

    // Connect and subscribe
    if (autoConnect) {
      wsManager.current.connect()
        .then(() => wsManager.current.subscribeToBook(bookId))
        .catch(console.error);
    }

    return () => {
      if (wsManager.current) {
        wsManager.current.off('orderBookUpdate', handleOrderBookUpdate);
        wsManager.current.off('connected', handleConnected);
        wsManager.current.off('disconnected', handleDisconnected);
        wsManager.current.unsubscribeFromBook(bookId);
      }
    };
  }, [bookId, autoConnect]);

  return {
    orderBook,
    isConnected,
    lastUpdate,
    refetch: useCallback(() => {
      // Trigger manual refresh
      setLastUpdate(Date.now());
    }, [])
  };
}

interface UsePriceTickerOptions {
  bookIds: number[];
}

export function usePriceTicker({ bookIds }: UsePriceTickerOptions) {
  const [prices, setPrices] = useState<Map<number, bigint>>(new Map());
  const [volumes, setVolumes] = useState<Map<number, bigint>>(new Map());
  const wsManager = useRef<CLOBWebSocketManager>();

  useEffect(() => {
    wsManager.current = getCLOBWebSocketManager();

    const handlePriceUpdate = (update: any) => {
      if (bookIds.includes(update.bookId)) {
        setPrices(prev => new Map(prev).set(update.bookId, update.price));
      }
    };

    const handleVolumeUpdate = (update: any) => {
      if (bookIds.includes(update.bookId)) {
        setVolumes(prev => new Map(prev).set(update.bookId, update.volume));
      }
    };

    wsManager.current.on('priceUpdate', handlePriceUpdate);
    wsManager.current.on('volumeUpdate', handleVolumeUpdate);

    // Subscribe to all books
    Promise.all(bookIds.map(id => wsManager.current!.subscribeToBook(id)))
      .catch(console.error);

    return () => {
      if (wsManager.current) {
        wsManager.current.off('priceUpdate', handlePriceUpdate);
        wsManager.current.off('volumeUpdate', handleVolumeUpdate);
        bookIds.forEach(id => wsManager.current!.unsubscribeFromBook(id));
      }
    };
  }, [bookIds]);

  return { prices, volumes };
}

interface UseUserOrdersOptions {
  autoConnect?: boolean;
}

export function useUserOrdersWebSocket({ autoConnect = true }: UseUserOrdersOptions) {
  const { address } = useAccount();
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [userTrades, setUserTrades] = useState<any[]>([]);
  const [userBalances, setUserBalances] = useState<Map<string, any>>(new Map());
  const wsManager = useRef<CLOBWebSocketManager>();

  useEffect(() => {
    if (!address) return;

    wsManager.current = getCLOBWebSocketManager();
    wsManager.current.setUserAddress(address);

    const handleUserOrderUpdate = (order: any) => {
      setUserOrders(prev => {
        const index = prev.findIndex(o => o.id === order.orderId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...order };
          return updated;
        }
        return [...prev, order];
      });
    };

    const handleTradeExecuted = (trade: any) => {
      const userAddr = address.toLowerCase();
      if (trade.buyer?.toLowerCase() === userAddr || 
          trade.seller?.toLowerCase() === userAddr) {
        setUserTrades(prev => [trade, ...prev].slice(0, 50)); // Keep last 50 trades
      }
    };

    const handleBalanceUpdate = (update: any) => {
      setUserBalances(prev => {
        const next = new Map(prev);
        next.set(update.token, update);
        return next;
      });
    };

    wsManager.current.on('userOrderUpdate', handleUserOrderUpdate);
    wsManager.current.on('tradeExecuted', handleTradeExecuted);
    wsManager.current.on('userBalanceUpdate', handleBalanceUpdate);

    if (autoConnect && !wsManager.current.getIsConnected()) {
      wsManager.current.connect().catch(console.error);
    }

    return () => {
      if (wsManager.current) {
        wsManager.current.off('userOrderUpdate', handleUserOrderUpdate);
        wsManager.current.off('tradeExecuted', handleTradeExecuted);
        wsManager.current.off('userBalanceUpdate', handleBalanceUpdate);
        wsManager.current.setUserAddress(null);
      }
    };
  }, [address, autoConnect]);

  return {
    userOrders,
    userTrades,
    userBalances
  };
}

interface UseRealtimeTradesOptions {
  bookId: number;
  limit?: number;
}

export function useRealtimeTrades({ bookId, limit = 50 }: UseRealtimeTradesOptions) {
  const [trades, setTrades] = useState<any[]>([]);
  const wsManager = useRef<CLOBWebSocketManager>();

  useEffect(() => {
    wsManager.current = getCLOBWebSocketManager();

    const handleTradeExecuted = (trade: any) => {
      if (trade.bookId === bookId) {
        setTrades(prev => [trade, ...prev].slice(0, limit));
      }
    };

    wsManager.current.on('tradeExecuted', handleTradeExecuted);
    wsManager.current.subscribeToBook(bookId).catch(console.error);

    return () => {
      if (wsManager.current) {
        wsManager.current.off('tradeExecuted', handleTradeExecuted);
        wsManager.current.unsubscribeFromBook(bookId);
      }
    };
  }, [bookId, limit]);

  return { trades };
}

// Connection status hook
export function useCLOBConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsManager = useRef<CLOBWebSocketManager>();

  useEffect(() => {
    wsManager.current = getCLOBWebSocketManager();

    const handleConnected = () => {
      setIsConnected(true);
      setReconnectAttempts(0);
    };
    
    const handleDisconnected = () => setIsConnected(false);
    
    const handleReconnectFailed = () => {
      setReconnectAttempts(prev => prev + 1);
    };

    wsManager.current.on('connected', handleConnected);
    wsManager.current.on('disconnected', handleDisconnected);
    wsManager.current.on('reconnectFailed', handleReconnectFailed);

    // Check current status
    setIsConnected(wsManager.current.getIsConnected());

    return () => {
      if (wsManager.current) {
        wsManager.current.off('connected', handleConnected);
        wsManager.current.off('disconnected', handleDisconnected);
        wsManager.current.off('reconnectFailed', handleReconnectFailed);
      }
    };
  }, []);

  const reconnect = useCallback(() => {
    if (wsManager.current) {
      wsManager.current.connect().catch(console.error);
    }
  }, []);

  return {
    isConnected,
    reconnectAttempts,
    reconnect
  };
}