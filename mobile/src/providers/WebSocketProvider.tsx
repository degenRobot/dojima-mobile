import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { NETWORK_CONFIG, CONTRACTS } from '../config/contracts';
import { WS_CONFIG } from '../config/constants';

interface WebSocketEvent {
  type: string;
  contractAddress: string;
  eventName: string;
  data: any;
  timestamp: number;
}

interface WebSocketContextType {
  isConnected: boolean;
  events: WebSocketEvent[];
  subscribeToContract: (contractAddress: string, eventNames?: string[]) => void;
  unsubscribeFromContract: (contractAddress: string) => void;
  sendMessage: (message: any) => void;
  getLatestEvents: (contractAddress: string, eventName?: string) => WebSocketEvent[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  events: [],
  subscribeToContract: () => {},
  unsubscribeFromContract: () => {},
  sendMessage: () => {},
  getLatestEvents: () => [],
});

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionsRef = useRef<Map<string, string[]>>(new Map());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('Connecting to WebSocket...');
    
    try {
      const ws = new WebSocket(NETWORK_CONFIG.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Resubscribe to all contracts
        subscriptionsRef.current.forEach((eventNames, contractAddress) => {
          subscribeToContractInternal(contractAddress, eventNames);
        });

        // Start heartbeat
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        stopHeartbeat();
        scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      scheduleReconnect();
    }
  }, []);

  // Handle incoming messages
  const handleMessage = (data: any) => {
    // Handle different message types
    if (data.type === 'event') {
      const event: WebSocketEvent = {
        type: 'contract_event',
        contractAddress: data.address,
        eventName: data.event,
        data: data.args,
        timestamp: Date.now(),
      };
      
      setEvents(prev => {
        // Keep only last 100 events to prevent memory issues
        const newEvents = [...prev, event];
        if (newEvents.length > 100) {
          return newEvents.slice(-100);
        }
        return newEvents;
      });
    } else if (data.type === 'subscription_confirmed') {
      console.log('Subscription confirmed:', data);
    } else if (data.type === 'pong') {
      // Heartbeat response
    }
  };

  // Schedule reconnection
  const scheduleReconnect = () => {
    if (reconnectAttemptsRef.current >= WS_CONFIG.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = WS_CONFIG.reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;

    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  };

  // Heartbeat to keep connection alive
  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, WS_CONFIG.heartbeatInterval);
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Subscribe to contract events (internal)
  const subscribeToContractInternal = (contractAddress: string, eventNames?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'rise_subscribe',
        params: {
          type: 'logs',
          filter: {
            address: contractAddress,
            topics: eventNames ? eventNames.map(name => `0x${name}`) : [],
          },
        },
      };
      
      wsRef.current.send(JSON.stringify(message));
    }
  };

  // Public subscribe method
  const subscribeToContract = (contractAddress: string, eventNames?: string[]) => {
    subscriptionsRef.current.set(contractAddress, eventNames || []);
    subscribeToContractInternal(contractAddress, eventNames);
  };

  // Unsubscribe from contract
  const unsubscribeFromContract = (contractAddress: string) => {
    subscriptionsRef.current.delete(contractAddress);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'rise_unsubscribe',
        params: {
          address: contractAddress,
        },
      };
      
      wsRef.current.send(JSON.stringify(message));
    }
  };

  // Send custom message
  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  };

  // Get latest events for a contract
  const getLatestEvents = (contractAddress: string, eventName?: string): WebSocketEvent[] => {
    return events.filter(event => {
      const matchesContract = event.contractAddress.toLowerCase() === contractAddress.toLowerCase();
      const matchesEvent = !eventName || event.eventName === eventName;
      return matchesContract && matchesEvent;
    });
  };

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Subscribe to main CLOB contracts
    if (CONTRACTS.UnifiedCLOB?.address) {
      subscribeToContract(CONTRACTS.UnifiedCLOB.address);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        events,
        subscribeToContract,
        unsubscribeFromContract,
        sendMessage,
        getLatestEvents,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}