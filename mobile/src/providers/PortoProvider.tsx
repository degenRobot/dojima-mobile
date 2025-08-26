import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem';
import * as SecureStore from 'expo-secure-store';
import { NETWORK_CONFIG, CONTRACTS } from '../config/contracts';
import { STORAGE_KEYS } from '../config/constants';
import { PortoClient } from '../lib/porto/client';
import { SessionWallet } from '../lib/porto/session';

interface PortoContextType {
  isInitialized: boolean;
  isConnected: boolean;
  sessionWallet: SessionWallet | null;
  userAddress: string | null;
  delegationStatus: 'none' | 'pending' | 'deployed' | 'error';
  initializeSession: () => Promise<void>;
  executeTransaction: (target: string, data: string, value?: bigint) => Promise<any>;
  checkDelegationStatus: () => Promise<void>;
}

const PortoContext = createContext<PortoContextType>({
  isInitialized: false,
  isConnected: false,
  sessionWallet: null,
  userAddress: null,
  delegationStatus: 'none',
  initializeSession: async () => {},
  executeTransaction: async () => {},
  checkDelegationStatus: async () => {},
});

export const usePorto = () => {
  const context = useContext(PortoContext);
  if (!context) {
    throw new Error('usePorto must be used within PortoProvider');
  }
  return context;
};

interface PortoProviderProps {
  children: ReactNode;
}

export function PortoProvider({ children }: PortoProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionWallet, setSessionWallet] = useState<SessionWallet | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [delegationStatus, setDelegationStatus] = useState<'none' | 'pending' | 'deployed' | 'error'>('none');
  const [portoClient, setPortoClient] = useState<PortoClient | null>(null);

  // Initialize Porto session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      console.log('Initializing Porto session...');
      
      // Get or create session key
      let sessionKey = await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_KEY);
      
      if (!sessionKey) {
        console.log('Creating new session key...');
        sessionKey = generatePrivateKey();
        await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_KEY, sessionKey);
      }

      // Create session account
      const account = privateKeyToAccount(sessionKey as `0x${string}`);
      console.log('Session account:', account.address);

      // Initialize Porto client
      const client = new PortoClient({
        relayUrl: NETWORK_CONFIG.portoRelayUrl,
        chainId: NETWORK_CONFIG.chainId,
        rpcUrl: NETWORK_CONFIG.rpcUrl,
      });

      // Create session wallet
      const wallet = new SessionWallet({
        sessionKey: sessionKey as `0x${string}`,
        account: account,
        portoClient: client,
      });

      setPortoClient(client);
      setSessionWallet(wallet);
      setUserAddress(account.address);
      setIsInitialized(true);

      // Check delegation status
      await checkDelegationStatusInternal(client, account.address);
      
      setIsConnected(true);
      console.log('Porto session initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Porto session:', error);
      setIsInitialized(true);
      setIsConnected(false);
    }
  };

  const checkDelegationStatusInternal = async (client: PortoClient, address: string) => {
    try {
      const status = await client.checkDelegationStatus(address);
      
      if (status.isDelegated) {
        setDelegationStatus('deployed');
      } else if (status.isPending) {
        setDelegationStatus('pending');
      } else {
        setDelegationStatus('none');
        // Setup delegation if not exists
        await setupDelegation(client, address);
      }
    } catch (error) {
      console.error('Failed to check delegation status:', error);
      setDelegationStatus('error');
    }
  };

  const setupDelegation = async (client: PortoClient, address: string) => {
    try {
      console.log('Setting up Porto delegation...');
      setDelegationStatus('pending');
      
      // Prepare delegation with admin key
      const result = await client.setupDelegation(address, sessionWallet!.account);
      
      if (result.success) {
        setDelegationStatus('deployed');
        console.log('Delegation setup successful');
      } else {
        setDelegationStatus('error');
        console.error('Delegation setup failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to setup delegation:', error);
      setDelegationStatus('error');
    }
  };

  const executeTransaction = async (target: string, data: string, value?: bigint) => {
    if (!sessionWallet || !portoClient) {
      throw new Error('Porto not initialized');
    }

    try {
      // Execute gasless transaction through Porto
      const result = await sessionWallet.executeTransaction({
        target,
        data,
        value: value || 0n,
      });

      return result;
    } catch (error) {
      console.error('Transaction execution failed:', error);
      throw error;
    }
  };

  const checkDelegationStatus = async () => {
    if (portoClient && userAddress) {
      await checkDelegationStatusInternal(portoClient, userAddress);
    }
  };

  return (
    <PortoContext.Provider
      value={{
        isInitialized,
        isConnected,
        sessionWallet,
        userAddress,
        delegationStatus,
        initializeSession,
        executeTransaction,
        checkDelegationStatus,
      }}
    >
      {children}
    </PortoContext.Provider>
  );
}