import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { privateKeyToAccount, generatePrivateKey, type PrivateKeyAccount } from 'viem/accounts';
import * as SecureStore from 'expo-secure-store';
import { 
  setupDelegation,
  sendTransaction,
  getAccountInfo,
  checkHealth,
  createAccount
} from '../lib/porto/simple-porto';
import { STORAGE_KEYS } from '../config/constants';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';
import type { Address, Hex } from 'viem';

interface PortoContextType {
  isInitialized: boolean;
  isConnected: boolean;
  account: PrivateKeyAccount | null;
  userAddress: string | null;
  delegationStatus: 'none' | 'checking' | 'setting-up' | 'ready' | 'error';
  initializeAccount: () => Promise<void>;
  setupAccountDelegation: () => Promise<boolean>;
  executeTransaction: (to: Address, data: Hex, value?: Hex) => Promise<any>;
  checkDelegationStatus: (silent?: boolean) => Promise<void>;
  markSetupComplete: () => void;
  resetWallet: () => Promise<void>;
}

const PortoContext = createContext<PortoContextType>({
  isInitialized: false,
  isConnected: false,
  account: null,
  userAddress: null,
  delegationStatus: 'none',
  initializeAccount: async () => {},
  setupAccountDelegation: async () => false,
  executeTransaction: async () => {},
  checkDelegationStatus: async () => {},
  markSetupComplete: () => {},
  resetWallet: async () => {},
});

export const PortoProvider = ({ children }: { children: ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<PrivateKeyAccount | null>(null);
  const [delegationStatus, setDelegationStatus] = useState<PortoContextType['delegationStatus']>('none');
  
  // Use ref to always have current account value
  const accountRef = useRef<PrivateKeyAccount | null>(null);
  
  // Track if delegation setup is in progress to prevent duplicates
  const delegationSetupInProgress = useRef(false);
  
  // Update ref when account changes
  useEffect(() => {
    accountRef.current = account;
    logDebug('PortoProvider', 'Account ref updated', { 
      address: account?.address,
      hasAccount: !!account 
    });
  }, [account]);

  // Initialize account from storage or create new
  const initializeAccount = useCallback(async () => {
    try {
      logInfo('PortoProvider', 'Starting account initialization...');
      
      // Try to load existing private key
      let privateKey: string | null = null;
      
      try {
        privateKey = await SecureStore.getItemAsync(STORAGE_KEYS.PRIVATE_KEY);
        if (privateKey) {
          logInfo('PortoProvider', 'Found existing private key in storage');
        }
      } catch (readError) {
        logWarn('PortoProvider', 'No existing key found or SecureStore error', { error: readError });
      }
      
      if (!privateKey) {
        // Generate new account
        logInfo('PortoProvider', 'Generating new private key...');
        logDebug('PortoProvider', 'generatePrivateKey type', { type: typeof generatePrivateKey });
        
        // Try to generate private key with error handling
        try {
          if (typeof generatePrivateKey === 'function') {
            privateKey = generatePrivateKey();
            logInfo('PortoProvider', 'Generated private key using viem');
          } else {
            // Fallback: generate random hex string manually
            logWarn('PortoProvider', 'Using fallback private key generation');
            const randomBytes = new Uint8Array(32);
            crypto.getRandomValues(randomBytes);
            privateKey = '0x' + Array.from(randomBytes)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('') as Hex;
          }
          
          logInfo('PortoProvider', 'Generated private key successfully');
          
          try {
            await SecureStore.setItemAsync(STORAGE_KEYS.PRIVATE_KEY, privateKey);
            logInfo('PortoProvider', 'Saved new private key to storage');
          } catch (saveError) {
            logError('PortoProvider', 'Failed to save private key to storage', { error: saveError });
            // Continue anyway - we can use the account in memory
          }
        } catch (genError) {
          logError('PortoProvider', 'Failed to generate private key', { error: genError });
          throw genError;
        }
      }

      const acc = createAccount(privateKey as Hex);
      logInfo('PortoProvider', 'Created account', { address: acc.address });
      
      setAccount(acc);
      accountRef.current = acc;
      setIsInitialized(true);
      logInfo('PortoProvider', 'Account initialization complete');
      
      return;
    } catch (error) {
      logError('PortoProvider', 'Failed to initialize account', { error });
      setDelegationStatus('error');
      setIsInitialized(false);
    }
  }, []);

  // Check if account is delegated
  const checkDelegationStatus = useCallback(async (silent = false) => {
    const currentAccount = accountRef.current;
    if (!currentAccount) {
      if (!silent) {
        logWarn('PortoProvider', 'No account available for delegation check');
      }
      setDelegationStatus('none');
      setIsConnected(false);
      return;
    }
    
    try {
      // Check if we have stored that delegation was setup
      const hasDelegated = await SecureStore.getItemAsync(STORAGE_KEYS.HAS_DELEGATED);
      
      if (hasDelegated === 'true') {
        // We've set up delegation before, mark as ready
        if (!silent) {
          logInfo('PortoProvider', 'Delegation previously setup, marking as ready');
        }
        setDelegationStatus('ready');
        setIsConnected(true);
        return;
      }
      
      // Only set to checking if not silent to prevent UI flicker
      if (!silent) {
        setDelegationStatus('checking');
        logInfo('PortoProvider', 'Checking delegation status', { address: currentAccount.address });
      }
      
      const info = await getAccountInfo(currentAccount.address);
      if (!silent) {
        logDebug('PortoProvider', 'Delegation info received', info);
      }
      
      if (info.isDelegated) {
        if (!silent || delegationStatus !== 'ready') {
          logInfo('PortoProvider', 'Account is delegated and ready');
          setDelegationStatus('ready');
        }
        setIsConnected(true);
        // Store that delegation is setup
        await SecureStore.setItemAsync(STORAGE_KEYS.HAS_DELEGATED, 'true');
      } else {
        if (!silent) {
          logInfo('PortoProvider', 'Account is not delegated - needs setup');
        }
        setDelegationStatus('none');
        setIsConnected(false);
      }
    } catch (error: any) {
      if (!silent) {
        logWarn('PortoProvider', 'Delegation check failed, assuming not delegated', { 
          error: error.message || error 
        });
      }
      // Instead of error state, assume not delegated
      // This is expected for new accounts
      setDelegationStatus('none');
      setIsConnected(false);
    }
  }, [delegationStatus]);

  // Setup delegation for the account
  const setupAccountDelegation = useCallback(async (): Promise<boolean> => {
    const currentAccount = accountRef.current;
    if (!currentAccount) {
      logError('PortoProvider', 'No account available to setup delegation');
      return false;
    }

    // Check if delegation setup is already in progress
    if (delegationSetupInProgress.current) {
      logInfo('PortoProvider', 'Delegation setup already in progress, skipping duplicate call');
      return true; // Return true to indicate it's being handled
    }

    // Check if delegation was already setup
    const hasDelegated = await SecureStore.getItemAsync(STORAGE_KEYS.HAS_DELEGATED);
    if (hasDelegated === 'true') {
      logInfo('PortoProvider', 'Delegation already setup, skipping');
      setDelegationStatus('ready');
      setIsConnected(true);
      return true;
    }

    try {
      delegationSetupInProgress.current = true;
      setDelegationStatus('setting-up');
      logInfo('PortoProvider', 'Setting up delegation', { address: currentAccount.address });
      
      const success = await setupDelegation(currentAccount);
      
      if (success) {
        // Store flag that delegation has been setup
        await SecureStore.setItemAsync(STORAGE_KEYS.HAS_DELEGATED, 'true');
        
        // Don't mark as ready yet - let the setup screen complete minting first
        logInfo('PortoProvider', 'Delegation setup successful - will deploy on first transaction');
        
        return true;
      } else {
        setDelegationStatus('error');
        logError('PortoProvider', 'Delegation setup failed');
        return false;
      }
    } catch (error) {
      logError('PortoProvider', 'Failed to setup delegation', { error });
      setDelegationStatus('error');
      return false;
    } finally {
      delegationSetupInProgress.current = false;
    }
  }, []);

  // Execute transaction
  const executeTransaction = useCallback(async (to: Address, data: Hex, value: Hex = '0x0') => {
    const currentAccount = accountRef.current;
    if (!currentAccount) {
      logError('PortoProvider', 'No account available for transaction');
      throw new Error('No account available for transaction');
    }

    // Check if delegation has been setup (stored in relay)
    const hasDelegated = await SecureStore.getItemAsync(STORAGE_KEYS.HAS_DELEGATED);
    if (hasDelegated !== 'true') {
      logError('PortoProvider', 'Delegation not setup - please complete setup first');
      throw new Error('Delegation not setup - please complete setup first');
    }

    // Send the transaction (delegation will deploy on first tx if needed)
    logDebug('PortoProvider', 'Sending transaction', { 
      from: currentAccount.address,
      to,
      value 
    });
    const result = await sendTransaction(currentAccount, to, data, value);
    logInfo('PortoProvider', 'Transaction sent successfully', { bundleId: result?.bundleId });
    return result;
  }, []);

  // Check Porto health on mount and periodically
  useEffect(() => {
    const checkConnection = async (silent = false) => {
      try {
        if (!silent) {
          logInfo('PortoProvider', 'Checking Porto relay health...');
        }
        const health = await checkHealth();
        if (!silent) {
          logInfo('PortoProvider', 'Porto relay health check successful', health);
        }
        setIsConnected(true);
      } catch (error) {
        if (!silent) {
          logError('PortoProvider', 'Porto relay not reachable', { error });
        }
        setIsConnected(false);
      }
    };

    // Initial check
    checkConnection(false);
    
    // Silent background checks every 30 seconds
    const interval = setInterval(() => checkConnection(true), 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize account on mount
  useEffect(() => {
    logInfo('PortoProvider', 'PortoProvider mounting, initializing account...');
    initializeAccount();
  }, [initializeAccount]);

  // Check delegation status when account is set and connected
  useEffect(() => {
    if (account && isConnected) {
      logInfo('PortoProvider', 'Account and connection ready, checking delegation...', {
        address: account.address,
        isConnected
      });
      // Initial check is not silent
      checkDelegationStatus(false);
      
      // Background silent checks every 20 seconds
      const interval = setInterval(() => {
        checkDelegationStatus(true);
      }, 20000);
      
      return () => clearInterval(interval);
    } else {
      logDebug('PortoProvider', 'Waiting for account or connection', {
        hasAccount: !!account,
        isConnected
      });
    }
  }, [account, isConnected]);

  // Mark setup as complete (called after minting is done)
  const markSetupComplete = useCallback(() => {
    logInfo('PortoProvider', 'Marking setup as complete');
    setDelegationStatus('ready');
    setIsConnected(true);
  }, []);

  // Reset wallet function - clears all stored data
  const resetWallet = useCallback(async () => {
    try {
      logInfo('PortoProvider', 'Resetting wallet...');
      
      // Clear all stored keys
      await SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.HAS_DELEGATED);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_KEY);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.DELEGATION_STATUS);
      
      // Reset state
      setAccount(null);
      accountRef.current = null;
      setDelegationStatus('none');
      setIsInitialized(false);
      
      logInfo('PortoProvider', 'Wallet reset complete');
      
      // Reinitialize with new account
      await initializeAccount();
    } catch (error) {
      logError('PortoProvider', 'Failed to reset wallet', { error });
      throw error;
    }
  }, [initializeAccount]);

  const value: PortoContextType = {
    isInitialized,
    isConnected,
    account,
    userAddress: account?.address || null,
    delegationStatus,
    initializeAccount,
    setupAccountDelegation,
    executeTransaction,
    checkDelegationStatus,
    markSetupComplete,
    resetWallet,
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