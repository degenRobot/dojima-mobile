/**
 * Real WebSocket Provider for RISE testnet
 * Provides real-time blockchain event subscriptions
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { NETWORK_CONFIG, CONTRACTS } from '../config/contracts';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';

interface WebSocketContextType {
  isConnected: boolean;
  events: any[];
  subscribeToContract: (contractAddress: string, eventNames?: string[]) => void;
  unsubscribeFromContract: (contractAddress: string) => void;
  sendMessage: (message: any) => void;
  getLatestEvents: (contractAddress: string, eventName?: string) => any[];
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  events: [],
  subscribeToContract: () => {},
  unsubscribeFromContract: () => {},
  sendMessage: () => {},
  getLatestEvents: () => [],
  reconnect: () => {},
});

export const RealWebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Map<string, string>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      logInfo('RealWebSocketProvider', 'Connecting to RISE WebSocket', { url: NETWORK_CONFIG.wsUrl });
      
      const ws = new WebSocket(NETWORK_CONFIG.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logInfo('RealWebSocketProvider', 'WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Re-subscribe to all active subscriptions
        subscriptionsRef.current.forEach((subId, contractAddress) => {
          const subscribeMessage = {
            jsonrpc: '2.0',
            method: 'eth_subscribe',
            params: ['logs', {
              address: contractAddress,
            }],
            id: Date.now(),
          };
          ws.send(JSON.stringify(subscribeMessage));
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.method === 'eth_subscription') {
            // Handle subscription event
            const eventData = data.params.result;
            logDebug('RealWebSocketProvider', 'Received event', { 
              address: eventData.address,
              topics: eventData.topics,
            });
            
            setEvents(prev => [...prev.slice(-99), eventData]); // Keep last 100 events
          } else if (data.id && data.result) {
            // Handle subscription confirmation
            logDebug('RealWebSocketProvider', 'Subscription confirmed', { 
              id: data.id,
              subscriptionId: data.result,
            });
          } else if (data.error) {
            logError('RealWebSocketProvider', 'WebSocket error', data.error);
          }
        } catch (error) {
          logError('RealWebSocketProvider', 'Failed to parse WebSocket message', { error, data: event.data });
        }
      };

      ws.onerror = (error) => {
        logError('RealWebSocketProvider', 'WebSocket error', { error });
      };

      ws.onclose = () => {
        logWarn('RealWebSocketProvider', 'WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          logInfo('RealWebSocketProvider', `Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          logError('RealWebSocketProvider', 'Max reconnection attempts reached');
        }
      };

    } catch (error) {
      logError('RealWebSocketProvider', 'Failed to connect', { error });
      setIsConnected(false);
    }
  }, []);

  // Subscribe to contract events
  const subscribeToContract = useCallback((contractAddress: string, eventNames?: string[]) => {
    if (!wsRef.current || !isConnected) {
      logWarn('RealWebSocketProvider', 'Cannot subscribe - WebSocket not connected');
      return;
    }

    // Check if already subscribed
    if (subscriptionsRef.current.has(contractAddress)) {
      logDebug('RealWebSocketProvider', 'Already subscribed to contract', { contractAddress });
      return;
    }

    const subscribeMessage = {
      jsonrpc: '2.0',
      method: 'eth_subscribe',
      params: ['logs', {
        address: contractAddress,
        topics: eventNames ? [] : null, // Could filter by event signatures
      }],
      id: Date.now(),
    };

    wsRef.current.send(JSON.stringify(subscribeMessage));
    subscriptionsRef.current.set(contractAddress, `sub_${Date.now()}`);
    
    logInfo('RealWebSocketProvider', 'Subscribed to contract', { 
      contractAddress,
      eventNames,
    });
  }, [isConnected]);

  // Unsubscribe from contract events
  const unsubscribeFromContract = useCallback((contractAddress: string) => {
    const subscriptionId = subscriptionsRef.current.get(contractAddress);
    
    if (!subscriptionId) {
      logDebug('RealWebSocketProvider', 'No subscription found for contract', { contractAddress });
      return;
    }

    if (wsRef.current && isConnected) {
      const unsubscribeMessage = {
        jsonrpc: '2.0',
        method: 'eth_unsubscribe',
        params: [subscriptionId],
        id: Date.now(),
      };
      wsRef.current.send(JSON.stringify(unsubscribeMessage));
    }

    subscriptionsRef.current.delete(contractAddress);
    logInfo('RealWebSocketProvider', 'Unsubscribed from contract', { contractAddress });
  }, [isConnected]);

  // Send custom message
  const sendMessage = useCallback((message: any) => {
    if (!wsRef.current || !isConnected) {
      logWarn('RealWebSocketProvider', 'Cannot send message - WebSocket not connected');
      return;
    }

    wsRef.current.send(JSON.stringify(message));
    logDebug('RealWebSocketProvider', 'Sent message', message);
  }, [isConnected]);

  // Get latest events for a contract
  const getLatestEvents = useCallback((contractAddress: string, eventName?: string) => {
    return events.filter(event => 
      event.address?.toLowerCase() === contractAddress.toLowerCase() &&
      (!eventName || event.topics?.[0] === eventName)
    );
  }, [events]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    logInfo('RealWebSocketProvider', 'Manual reconnect requested');
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount
  useEffect(() => {
    connect();
    
    // Subscribe to CLOB contract by default
    const timer = setTimeout(() => {
      if (isConnected) {
        subscribeToContract(CONTRACTS.UnifiedCLOB.address);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    events,
    subscribeToContract,
    unsubscribeFromContract,
    sendMessage,
    getLatestEvents,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};