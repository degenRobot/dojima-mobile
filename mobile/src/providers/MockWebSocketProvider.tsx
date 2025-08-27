import React, { createContext, useContext, ReactNode } from 'react';

interface WebSocketContextType {
  isConnected: boolean;
  events: any[];
  subscribeToContract: (contractAddress: string, eventNames?: string[]) => void;
  unsubscribeFromContract: (contractAddress: string) => void;
  sendMessage: (message: any) => void;
  getLatestEvents: (contractAddress: string, eventName?: string) => any[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  events: [],
  subscribeToContract: () => {},
  unsubscribeFromContract: () => {},
  sendMessage: () => {},
  getLatestEvents: () => [],
});

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  // Simple mock provider that doesn't try to connect
  const value: WebSocketContextType = {
    isConnected: false,
    events: [],
    subscribeToContract: (contractAddress, eventNames) => {
      console.log('Mock: Subscribe to contract', { contractAddress, eventNames });
    },
    unsubscribeFromContract: (contractAddress) => {
      console.log('Mock: Unsubscribe from contract', contractAddress);
    },
    sendMessage: (message) => {
      console.log('Mock: Send message', message);
    },
    getLatestEvents: (contractAddress, eventName) => {
      console.log('Mock: Get latest events', { contractAddress, eventName });
      return [];
    },
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};