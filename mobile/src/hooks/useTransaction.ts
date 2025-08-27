/**
 * Hook for handling blockchain transactions
 * Provides loading states, error handling, and success callbacks
 */

import { useState, useCallback } from 'react';
import { usePorto } from '../providers/SimplePortoProvider';
import { logInfo, logError, logDebug } from '../utils/logger';
import type { Address, Hex } from 'viem';

interface TransactionOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseTransactionResult {
  execute: (to: Address, data: Hex, value?: Hex) => Promise<any>;
  loading: boolean;
  error: string | null;
  txHash: string | null;
  reset: () => void;
}

export function useTransaction(options: TransactionOptions = {}): UseTransactionResult {
  const { executeTransaction } = usePorto();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const execute = useCallback(async (
    to: Address,
    data: Hex,
    value?: Hex
  ): Promise<any> => {
    try {
      setLoading(true);
      setError(null);
      setTxHash(null);

      logDebug('useTransaction', 'Starting transaction', { to, hasValue: !!value });

      const result = await executeTransaction(to, data, value);
      
      if (result?.bundleId) {
        setTxHash(result.bundleId);
        logInfo('useTransaction', 'Transaction successful', { 
          bundleId: result.bundleId,
          successMessage: options.successMessage 
        });
        
        if (options.onSuccess) {
          options.onSuccess(result);
        }
        
        return result;
      } else {
        throw new Error('Transaction failed - no bundle ID returned');
      }
    } catch (err: any) {
      const errorMsg = err.message || options.errorMessage || 'Transaction failed';
      logError('useTransaction', 'Transaction failed', { error: errorMsg });
      setError(errorMsg);
      
      if (options.onError) {
        options.onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, options]);

  const reset = useCallback(() => {
    setError(null);
    setTxHash(null);
    setLoading(false);
  }, []);

  return {
    execute,
    loading,
    error,
    txHash,
    reset,
  };
}

/**
 * Hook for batch transactions
 */
export function useBatchTransaction(options: TransactionOptions = {}) {
  const { executeTransaction } = usePorto();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const executeBatch = useCallback(async (
    transactions: Array<{ to: Address; data: Hex; value?: Hex }>
  ): Promise<any[]> => {
    try {
      setLoading(true);
      setError(null);
      setResults([]);

      logDebug('useBatchTransaction', 'Starting batch', { 
        count: transactions.length 
      });

      const txResults: any[] = [];
      
      // Execute transactions sequentially to avoid nonce issues
      for (const tx of transactions) {
        try {
          const result = await executeTransaction(tx.to, tx.data, tx.value);
          txResults.push(result);
        } catch (err: any) {
          logError('useBatchTransaction', 'Transaction in batch failed', { 
            error: err.message,
            to: tx.to 
          });
          // Continue with other transactions
          txResults.push({ error: err.message });
        }
      }

      setResults(txResults);
      
      const successful = txResults.filter(r => !r.error).length;
      logInfo('useBatchTransaction', 'Batch complete', { 
        successful,
        total: transactions.length 
      });
      
      if (options.onSuccess && successful > 0) {
        options.onSuccess(txResults);
      }
      
      return txResults;
    } catch (err: any) {
      const errorMsg = err.message || 'Batch transaction failed';
      logError('useBatchTransaction', 'Batch failed', { error: errorMsg });
      setError(errorMsg);
      
      if (options.onError) {
        options.onError(err);
      }
      
      return [];
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, options]);

  return {
    executeBatch,
    loading,
    error,
    results,
  };
}