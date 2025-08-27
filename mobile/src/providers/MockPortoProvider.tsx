import React, { createContext, useContext, ReactNode } from 'react';

interface PortoContextType {
  isInitialized: boolean;
  isConnected: boolean;
  sessionWallet: any | null;
  userAddress: string | null;
  delegationStatus: 'none' | 'pending' | 'deployed' | 'error';
  initializeSession: () => Promise<void>;
  executeTransaction: (target: string, data: string, value?: bigint) => Promise<any>;
  checkDelegationStatus: () => Promise<void>;
}

const PortoContext = createContext<PortoContextType>({
  isInitialized: true,
  isConnected: false,
  sessionWallet: null,
  userAddress: null,
  delegationStatus: 'none',
  initializeSession: async () => {
    console.log('Mock: Initialize session');
  },
  executeTransaction: async () => {
    console.log('Mock: Execute transaction');
    return { hash: '0xmock' };
  },
  checkDelegationStatus: async () => {
    console.log('Mock: Check delegation status');
  },
});

export const PortoProvider = ({ children }: { children: ReactNode }) => {
  // Simple mock provider that doesn't try to connect to anything
  const value: PortoContextType = {
    isInitialized: true,
    isConnected: false,
    sessionWallet: null,
    userAddress: '0x0000000000000000000000000000000000000000',
    delegationStatus: 'none',
    initializeSession: async () => {
      console.log('Mock: Initialize session');
    },
    executeTransaction: async (target, data, value) => {
      console.log('Mock: Execute transaction', { target, data, value });
      return { hash: '0xmock', success: true };
    },
    checkDelegationStatus: async () => {
      console.log('Mock: Check delegation status');
    },
  };

  return <PortoContext.Provider value={value}>{children}</PortoContext.Provider>;
};

export const usePorto = () => {
  const context = useContext(PortoContext);
  if (!context) {
    throw new Error('usePorto must be used within PortoProvider');
  }
  return context;
};