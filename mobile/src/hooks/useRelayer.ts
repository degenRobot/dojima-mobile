/**
 * Hook for interacting with Porto Relay
 * Provides clean interface for delegation and key management
 */

import { useState, useCallback, useEffect } from 'react';
import { type Address, type Hex } from 'viem';
import { usePorto } from '../providers/SimplePortoProvider';
import { 
  getWalletKeys, 
  checkDelegationViaRPC,
  checkHealth as checkRelayHealth 
} from '../lib/porto/simple-porto';
import { NETWORK_CONFIG, CONTRACTS } from '../config/contracts';
import { logDebug, logError, logInfo } from '../utils/logger';

interface WalletKey {
  hash: string;
  key: {
    expiry?: string;
    type: 'p256' | 'webauthnp256' | 'secp256k1';
    role: 'admin' | 'normal' | 'session';
    publicKey: string;
  };
  permissions: Array<{
    type: 'call' | 'spend';
    selector?: string;
    to?: Address;
    limit?: number;
    period?: string;
    token?: Address;
  }>;
}

interface RelayerState {
  isHealthy: boolean;
  isDelegated: boolean;
  keys: WalletKey[];
  delegationAddress?: Address;
  lastHealthCheck?: Date;
}

export function useRelayer() {
  const { userAddress, account, delegationStatus } = usePorto();
  const [state, setState] = useState<RelayerState>({
    isHealthy: false,
    isDelegated: false,
    keys: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check relay health status
   */
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      logDebug('useRelayer', 'Checking relay health');
      const health = await checkRelayHealth();
      
      setState(prev => ({
        ...prev,
        isHealthy: true,
        lastHealthCheck: new Date(),
      }));
      
      logInfo('useRelayer', 'Relay is healthy', { health });
      return true;
    } catch (error: any) {
      logError('useRelayer', 'Relay health check failed', { error: error.message });
      setState(prev => ({
        ...prev,
        isHealthy: false,
        lastHealthCheck: new Date(),
      }));
      return false;
    }
  }, []);

  /**
   * Get delegation keys from relay
   */
  const fetchKeys = useCallback(async (): Promise<WalletKey[]> => {
    if (!userAddress) {
      return [];
    }

    try {
      logDebug('useRelayer', 'Fetching wallet keys', { address: userAddress });
      const keys = await getWalletKeys(userAddress as Address);
      
      if (keys && Array.isArray(keys)) {
        logInfo('useRelayer', 'Found wallet keys', { count: keys.length });
        return keys as WalletKey[];
      }
      
      return [];
    } catch (error: any) {
      logError('useRelayer', 'Failed to fetch keys', { error: error.message });
      return [];
    }
  }, [userAddress]);

  /**
   * Check delegation status via RPC
   */
  const checkDelegation = useCallback(async (): Promise<boolean> => {
    if (!userAddress) {
      return false;
    }

    try {
      logDebug('useRelayer', 'Checking delegation status', { address: userAddress });
      const isDelegated = await checkDelegationViaRPC(userAddress as Address);
      
      logInfo('useRelayer', 'Delegation check complete', { isDelegated });
      return isDelegated;
    } catch (error: any) {
      logError('useRelayer', 'Failed to check delegation', { error: error.message });
      return false;
    }
  }, [userAddress]);

  /**
   * Refresh all relayer data
   */
  const refresh = useCallback(async (silent = false) => {
    if (!userAddress) {
      setState({
        isHealthy: false,
        isDelegated: false,
        keys: [],
      });
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      
      // Check health
      const healthy = await checkHealth();
      
      // Check delegation
      const delegated = await checkDelegation();
      
      // Fetch keys if delegated
      let keys: WalletKey[] = [];
      if (delegated) {
        keys = await fetchKeys();
      }
      
      setState({
        isHealthy: healthy,
        isDelegated: delegated,
        keys,
        delegationAddress: delegated ? CONTRACTS.PortoDelegationProxy.address : undefined,
        lastHealthCheck: new Date(),
      });
      
      logInfo('useRelayer', 'Relayer state updated', {
        isHealthy: healthy,
        isDelegated: delegated,
        keyCount: keys.length,
      });
      
    } catch (error: any) {
      logError('useRelayer', 'Failed to refresh relayer state', { error: error.message });
      setError(error.message || 'Failed to refresh relayer state');
    } finally {
      setLoading(false);
    }
  }, [userAddress, checkHealth, checkDelegation, fetchKeys]);

  /**
   * Get formatted key information
   */
  const getKeyInfo = useCallback((): string => {
    if (state.keys.length === 0) {
      return 'No keys found';
    }
    
    const keyInfo = state.keys.map((key, index) => {
      const expiry = key.key.expiry === '0x0' ? 'Never' : 
                    key.key.expiry ? new Date(parseInt(key.key.expiry) * 1000).toLocaleDateString() : 
                    'Unknown';
      
      return `Key ${index + 1}: ${key.key.type} (${key.key.role}) - Expires: ${expiry}`;
    });
    
    return keyInfo.join('\n');
  }, [state.keys]);

  /**
   * Check if a specific permission exists
   */
  const hasPermission = useCallback((
    contractAddress: Address,
    functionSelector?: string
  ): boolean => {
    if (state.keys.length === 0) return false;
    
    for (const key of state.keys) {
      // Admin keys have all permissions
      if (key.key.role === 'admin') return true;
      
      // Check specific permissions
      for (const perm of key.permissions) {
        if (perm.type === 'call' && perm.to === contractAddress) {
          if (!functionSelector || perm.selector === functionSelector) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [state.keys]);

  /**
   * Get spending limit for a token
   */
  const getSpendingLimit = useCallback((
    tokenAddress?: Address
  ): { limit: number; period: string } | null => {
    if (state.keys.length === 0) return null;
    
    for (const key of state.keys) {
      for (const perm of key.permissions) {
        if (perm.type === 'spend') {
          if (!tokenAddress || perm.token === tokenAddress) {
            return {
              limit: perm.limit || 0,
              period: perm.period || 'unknown',
            };
          }
        }
      }
    }
    
    return null;
  }, [state.keys]);

  // Auto-refresh on mount and when user changes
  useEffect(() => {
    if (userAddress) {
      refresh(false);
      
      // Periodic health checks (every 30 seconds)
      const interval = setInterval(() => {
        refresh(true); // Silent refresh
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [userAddress]);

  // Update when delegation status changes
  useEffect(() => {
    if (delegationStatus === 'ready' && !state.isDelegated) {
      refresh(false);
    }
  }, [delegationStatus, state.isDelegated]);

  return {
    // State
    ...state,
    loading,
    error,
    
    // Actions
    refresh,
    checkHealth,
    checkDelegation,
    fetchKeys,
    
    // Utilities
    getKeyInfo,
    hasPermission,
    getSpendingLimit,
  };
}