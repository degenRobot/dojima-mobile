'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { createPublicClient, http, type PublicClient } from 'viem';
import { riseTestnet } from '@/lib/wagmi-config';

// Create singleton public client for non-React contexts
let singletonClient: PublicClient | null = null;

/**
 * Get singleton public client (for non-React contexts like classes)
 */
export function getPublicClientSingleton() {
  if (!singletonClient) {
    singletonClient = createPublicClient({
      chain: riseTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet.riselabs.xyz'),
    });
  }
  return singletonClient;
}

interface PublicClientContextType {
  publicClient: PublicClient;
}

const PublicClientContext = createContext<PublicClientContextType | null>(null);

/**
 * Provider for a singleton public client instance
 * This prevents creating multiple clients on every component render
 */
export function PublicClientProvider({ children }: { children: React.ReactNode }) {
  // Create a single public client instance that's shared across the app
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: riseTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet.riselabs.xyz'),
    });
  }, []); // Empty deps means this only runs once

  const value = useMemo(() => ({ publicClient }), [publicClient]);

  return (
    <PublicClientContext.Provider value={value}>
      {children}
    </PublicClientContext.Provider>
  );
}

/**
 * Hook to access the singleton public client
 */
export function usePublicClient() {
  const context = useContext(PublicClientContext);
  if (!context) {
    throw new Error('usePublicClient must be used within PublicClientProvider');
  }
  return context.publicClient;
}