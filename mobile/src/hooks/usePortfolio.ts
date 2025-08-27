/**
 * Hook for managing portfolio data (balances, positions, etc.)
 * Handles reading contract state without modifying it
 */

import { useState, useEffect, useCallback } from 'react';
import { encodeFunctionData, decodeFunctionResult, formatUnits, type Address, type Hex } from 'viem';
import { usePorto } from '../providers/SimplePortoProvider';
import { CONTRACTS, NETWORK_CONFIG, TRADING_BOOKS } from '../config/contracts';
import { MintableERC20ABI, UnifiedCLOBV2ABI } from '../config/abis';
import { logDebug, logError, logInfo } from '../utils/logger';

interface TokenBalance {
  symbol: string;
  address: Address;
  decimals: number;
  walletBalance: string;
  walletBalanceRaw: bigint;
  clobBalance: string;
  clobBalanceRaw: bigint;
  clobLocked: string;
  clobLockedRaw: bigint;
  totalValue: number;
}

interface PortfolioSummary {
  totalValueUSD: number;
  walletTotalUSD: number;
  clobTotalUSD: number;
  tokens: TokenBalance[];
}

// Hardcoded prices for value calculations
const TOKEN_PRICES_USD: Record<string, number> = {
  USDC: 1,
  WETH: 2500,
  WBTC: 65000,
};

export function usePortfolio() {
  const { userAddress } = usePorto();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Make an eth_call to read contract data
   */
  const readContract = useCallback(async (
    to: Address,
    data: Hex
  ): Promise<Hex> => {
    try {
      const response = await fetch(NETWORK_CONFIG.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to, data }, 'latest'],
          id: Date.now(),
        }),
      });
      
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return result.result;
    } catch (error: any) {
      logError('usePortfolio', 'Failed to read contract', { to, error: error.message });
      throw error;
    }
  }, []);

  /**
   * Get token balance in wallet
   */
  const getTokenBalance = useCallback(async (
    tokenAddress: Address,
    userAddr: Address
  ): Promise<bigint> => {
    try {
      const data = encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: 'balanceOf',
        args: [userAddr],
      });
      
      const result = await readContract(tokenAddress, data);
      
      const decoded = decodeFunctionResult({
        abi: MintableERC20ABI,
        functionName: 'balanceOf',
        data: result,
      });
      
      return decoded as bigint;
    } catch (error) {
      logError('usePortfolio', 'Failed to get token balance', { tokenAddress, error });
      return 0n;
    }
  }, [readContract]);

  /**
   * Get CLOB balance (available and locked)
   */
  const getCLOBBalance = useCallback(async (
    userAddr: Address,
    tokenAddress: Address
  ): Promise<{ available: bigint; locked: bigint }> => {
    try {
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'getBalance',
        args: [userAddr, tokenAddress],
      });
      
      const result = await readContract(CONTRACTS.UnifiedCLOB.address, data);
      
      // Check if result is valid
      if (!result || result === '0x') {
        logWarn('usePortfolio', 'Empty result from CLOB balance call', { userAddr, tokenAddress });
        return { available: 0n, locked: 0n };
      }
      
      const decoded = decodeFunctionResult({
        abi: UnifiedCLOBV2ABI,
        functionName: 'getBalance',
        data: result,
      }) as [bigint, bigint];
      
      return {
        available: decoded[0] || 0n,
        locked: decoded[1] || 0n,
      };
    } catch (error: any) {
      logError('usePortfolio', 'Failed to get CLOB balance', { 
        tokenAddress, 
        userAddr,
        error: error.message || error 
      });
      return { available: 0n, locked: 0n };
    }
  }, [readContract]);

  /**
   * Refresh all portfolio data
   */
  const refreshPortfolio = useCallback(async (silent = false) => {
    if (!userAddress) {
      setPortfolio(null);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      
      logDebug('usePortfolio', 'Refreshing portfolio', { userAddress });
      
      // Fetch balances for all tokens
      const tokenBalances: TokenBalance[] = [];
      
      for (const [symbol, token] of Object.entries(CONTRACTS)) {
        if (symbol === 'UnifiedCLOB' || symbol === 'PortoDelegationProxy' || symbol === 'PortoOrchestrator') {
          continue; // Skip non-token contracts
        }
        
        // Get wallet balance
        const walletBalance = await getTokenBalance(token.address, userAddress);
        
        // Get CLOB balances
        let clobBalances: { available: bigint; locked: bigint };
        try {
          clobBalances = await getCLOBBalance(userAddress, token.address);
        } catch (error: any) {
          logError('usePortfolio', 'Failed to get CLOB balance for token', { 
            symbol, 
            tokenAddress: token.address, 
            error: error.message 
          });
          // Use default values if CLOB balance fails
          clobBalances = { available: 0n, locked: 0n };
        }
        
        // Safety check - ensure clobBalances is valid
        if (!clobBalances) {
          logError('usePortfolio', 'getCLOBBalance returned undefined', { symbol, tokenAddress: token.address });
          clobBalances = { available: 0n, locked: 0n };
        }
        
        // Format balances
        const formatted: TokenBalance = {
          symbol,
          address: token.address,
          decimals: token.decimals,
          walletBalanceRaw: walletBalance,
          walletBalance: formatUnits(walletBalance, token.decimals),
          clobBalanceRaw: clobBalances.available || 0n,
          clobBalance: formatUnits(clobBalances.available || 0n, token.decimals),
          clobLockedRaw: clobBalances.locked || 0n,
          clobLocked: formatUnits(clobBalances.locked || 0n, token.decimals),
          totalValue: 0, // Will calculate below
        };
        
        // Calculate USD value
        const price = TOKEN_PRICES_USD[symbol] || 0;
        const totalTokens = parseFloat(formatted.walletBalance) + 
                           parseFloat(formatted.clobBalance) + 
                           parseFloat(formatted.clobLocked);
        formatted.totalValue = totalTokens * price;
        
        tokenBalances.push(formatted);
      }
      
      // Calculate portfolio summary
      const walletTotalUSD = tokenBalances.reduce((sum, token) => {
        const price = TOKEN_PRICES_USD[token.symbol] || 0;
        return sum + (parseFloat(token.walletBalance) * price);
      }, 0);
      
      const clobTotalUSD = tokenBalances.reduce((sum, token) => {
        const price = TOKEN_PRICES_USD[token.symbol] || 0;
        const clobTotal = parseFloat(token.clobBalance) + parseFloat(token.clobLocked);
        return sum + (clobTotal * price);
      }, 0);
      
      const summary: PortfolioSummary = {
        totalValueUSD: walletTotalUSD + clobTotalUSD,
        walletTotalUSD,
        clobTotalUSD,
        tokens: tokenBalances,
      };
      
      setPortfolio(summary);
      logInfo('usePortfolio', 'Portfolio refreshed', { 
        totalValue: summary.totalValueUSD,
        tokenCount: tokenBalances.length 
      });
      
    } catch (error: any) {
      logError('usePortfolio', 'Failed to refresh portfolio', { error: error.message });
      setError(error.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userAddress, getTokenBalance, getCLOBBalance]);

  /**
   * Public refresh function for pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshPortfolio(false);
  }, [refreshPortfolio]);

  /**
   * Get a specific token balance
   */
  const getTokenInfo = useCallback((symbol: string): TokenBalance | undefined => {
    return portfolio?.tokens.find(t => t.symbol === symbol);
  }, [portfolio]);

  /**
   * Check if user has sufficient balance
   */
  const hasBalance = useCallback((
    symbol: string, 
    amount: string,
    location: 'wallet' | 'clob' = 'wallet'
  ): boolean => {
    const token = getTokenInfo(symbol);
    if (!token) return false;
    
    const amountFloat = parseFloat(amount);
    const balance = location === 'wallet' 
      ? parseFloat(token.walletBalance)
      : parseFloat(token.clobBalance);
      
    return balance >= amountFloat;
  }, [getTokenInfo]);

  // Auto-refresh on mount and when user address changes
  useEffect(() => {
    if (userAddress) {
      refreshPortfolio(false);
      
      // Set up periodic refresh (every 30 seconds)
      const interval = setInterval(() => {
        refreshPortfolio(true); // Silent refresh
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [userAddress]);

  return {
    // State
    portfolio,
    loading,
    refreshing,
    error,
    
    // Actions
    refreshPortfolio,
    handleRefresh,
    
    // Utilities
    getTokenInfo,
    hasBalance,
    
    // Constants
    TOKEN_PRICES_USD,
  };
}