/**
 * Consolidated hook for making contract calls
 * Provides a clean interface for reading contract state
 */

import { useState, useCallback } from 'react';
import { encodeFunctionData, decodeFunctionResult, type Hex, type Address, type Abi } from 'viem';
import { NETWORK_CONFIG } from '../config/contracts';
import { logDebug, logError, logInfo } from '../utils/logger';

interface UseContractCallOptions {
  abi: Abi;
  address: Address;
  functionName: string;
}

interface ContractCallResult<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  call: (args?: any[]) => Promise<T | null>;
  refresh: () => Promise<void>;
}

/**
 * Hook for making contract read calls via eth_call
 */
export function useContractCall<T = any>({
  abi,
  address,
  functionName,
}: UseContractCallOptions): ContractCallResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastArgs, setLastArgs] = useState<any[] | undefined>();

  const call = useCallback(async (args?: any[]): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      setLastArgs(args);

      logDebug('useContractCall', 'Making contract call', { 
        address, 
        functionName, 
        hasArgs: !!args 
      });

      // Encode the function call
      const callData = encodeFunctionData({
        abi,
        functionName,
        args: args || [],
      });

      // Make the RPC call
      const response = await fetch(NETWORK_CONFIG.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: address,
              data: callData,
            },
            'latest'
          ],
          id: Date.now(),
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'RPC call failed');
      }

      // Decode the result
      const decoded = decodeFunctionResult({
        abi,
        functionName,
        data: result.result as Hex,
      }) as T;

      setData(decoded);
      logInfo('useContractCall', 'Contract call successful', { 
        functionName,
        hasResult: decoded !== null && decoded !== undefined 
      });
      
      return decoded;
    } catch (err: any) {
      const errorMessage = err.message || 'Contract call failed';
      logError('useContractCall', 'Contract call failed', { 
        functionName, 
        error: errorMessage 
      });
      setError(errorMessage);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [abi, address, functionName]);

  const refresh = useCallback(async () => {
    if (lastArgs !== undefined) {
      await call(lastArgs);
    }
  }, [call, lastArgs]);

  return {
    data,
    loading,
    error,
    call,
    refresh,
  };
}

/**
 * Hook for making multiple contract calls in parallel
 */
export function useMultipleContractCalls(
  calls: Array<UseContractCallOptions & { args?: any[] }>
) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const promises = calls.map(async ({ abi, address, functionName, args }) => {
        try {
          const callData = encodeFunctionData({
            abi,
            functionName,
            args: args || [],
          });

          const response = await fetch(NETWORK_CONFIG.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [
                {
                  to: address,
                  data: callData,
                },
                'latest'
              ],
              id: Date.now() + Math.random(),
            }),
          });

          const result = await response.json();
          
          if (result.error) {
            throw new Error(result.error.message);
          }

          return decodeFunctionResult({
            abi,
            functionName,
            data: result.result as Hex,
          });
        } catch (err) {
          logError('useMultipleContractCalls', 'Call failed', { 
            functionName, 
            error: err 
          });
          return null;
        }
      });

      const data = await Promise.all(promises);
      setResults(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Multiple calls failed');
      return [];
    } finally {
      setLoading(false);
    }
  }, [calls]);

  return {
    results,
    loading,
    error,
    execute,
  };
}