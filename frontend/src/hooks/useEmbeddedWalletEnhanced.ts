import { useState, useEffect, useCallback, useRef } from 'react';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { type Account, formatEther } from 'viem';
import { createWalletClient, http, type WalletClient } from 'viem';
import { NonceManager } from '@/lib/wallet/NonceManager';
import { RISE_RPC_URL, RISE_CHAIN_ID } from '@/config/websocket';
import { usePublicClient } from '@/providers/PublicClientProvider';

const STORAGE_KEY = 'rise-embedded-wallet';

// Define RISE chain
const riseChain = {
  id: RISE_CHAIN_ID,
  name: 'RISE Testnet',
  network: 'rise-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: [RISE_RPC_URL] },
    public: { http: [RISE_RPC_URL] },
  },
  testnet: true,
} as const;

export function useEmbeddedWalletEnhanced() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<string>('0');
  const nonceManagerRef = useRef<NonceManager | null>(null);
  const publicClient = usePublicClient();
  const walletClientRef = useRef<WalletClient | null>(null);


  // Initialize wallet from storage
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    
    const savedPrivateKey = localStorage.getItem(STORAGE_KEY);
    
    if (savedPrivateKey) {
      try {
        const acc = privateKeyToAccount(savedPrivateKey as `0x${string}`);
        setAccount(acc);
        setIsConnected(true);
        
        // Create wallet client
        walletClientRef.current = createWalletClient({
          account: acc,
          chain: riseChain,
          transport: http(RISE_RPC_URL),
        });
        
        // Initialize nonce manager
        if (publicClient) {
          nonceManagerRef.current = new NonceManager(publicClient, acc.address);
          nonceManagerRef.current.initialize();
        }
      } catch {
        // Invalid saved private key
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    
    setIsLoading(false);
  }, [publicClient]);

  // Update balance
  useEffect(() => {
    if (account?.address && publicClient) {
      const updateBalance = async () => {
        try {
          const balance = await publicClient.getBalance({
            address: account.address,
          });
          setBalance(formatEther(balance));
        } catch {
          // Failed to fetch balance, silently continue
        }
      };

      updateBalance();
      const interval = setInterval(updateBalance, 10000); // Update every 10s

      return () => clearInterval(interval);
    }
  }, [account?.address, publicClient]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    const privateKey = generatePrivateKey();
    const acc = privateKeyToAccount(privateKey);
    
    localStorage.setItem(STORAGE_KEY, privateKey);
    setAccount(acc);
    setIsConnected(true);
    
    // Create wallet client
    walletClientRef.current = createWalletClient({
      account: acc,
      chain: riseChain,
      transport: http(RISE_RPC_URL),
    });
    
    // Initialize nonce manager
    // Use the singleton public client
    nonceManagerRef.current = new NonceManager(publicClient, acc.address);
    nonceManagerRef.current.initialize();
    
    return acc;
  }, [publicClient]);

  const disconnect = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setAccount(null);
    setIsConnected(false);
    setBalance('0');
    nonceManagerRef.current?.reset();
    nonceManagerRef.current = null;
    walletClientRef.current = null;
  }, []);

  const exportPrivateKey = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    const privateKey = localStorage.getItem(STORAGE_KEY);
    return privateKey;
  }, []);

  const copyPrivateKeyToClipboard = useCallback(async (): Promise<boolean> => {
    const privateKey = await exportPrivateKey();
    if (!privateKey) return false;
    
    const { copyToClipboard } = await import('@/lib/utils');
    return await copyToClipboard(privateKey);
  }, [exportPrivateKey]);

  const importPrivateKey = useCallback((privateKey: string) => {
    if (typeof window === 'undefined') return null;
    
    try {
      // Validate private key format
      if (!privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
      }
      
      const acc = privateKeyToAccount(privateKey as `0x${string}`);
      
      localStorage.setItem(STORAGE_KEY, privateKey);
      setAccount(acc);
      setIsConnected(true);
      
      // Create wallet client
      walletClientRef.current = createWalletClient({
        account: acc,
        chain: riseChain,
        transport: http(RISE_RPC_URL),
      });
      
      // Initialize nonce manager
      // Use the singleton public client
      nonceManagerRef.current = new NonceManager(publicClient, acc.address);
      nonceManagerRef.current.initialize();
      
      return acc;
    } catch {
      throw new Error('Invalid private key format');
    }
  }, [publicClient]);

  // Get next nonce for transaction
  const getNextNonce = useCallback(async () => {
    if (!nonceManagerRef.current) {
      throw new Error('Nonce manager not initialized');
    }
    return await nonceManagerRef.current.getNonce();
  }, []);

  // Report transaction completion
  const reportTransactionComplete = useCallback(async (success: boolean) => {
    if (nonceManagerRef.current) {
      await nonceManagerRef.current.onTransactionComplete(success);
    }
  }, []);

  return {
    account,
    address: account?.address,
    balance,
    isConnected,
    isLoading,
    publicClient,
    walletClient: walletClientRef.current,
    connect,
    disconnect,
    exportPrivateKey,
    copyPrivateKeyToClipboard,
    importPrivateKey,
    getNextNonce,
    reportTransactionComplete,
  };
}