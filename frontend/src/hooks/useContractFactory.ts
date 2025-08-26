import { useState, useCallback } from 'react';
import { createWalletClient, http, encodeFunctionData, parseEther, type PublicClient, type WalletClient, type Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { useAccount, useWalletClient } from 'wagmi';
import { usePublicClient } from '@/providers/PublicClientProvider';
import { RISE_RPC_URL, RISE_TESTNET } from '@/config/chain';
import { useEnsureNetwork } from './useEnsureNetwork';
import { RiseSyncClient } from '@/lib/rise-sync-client';
import { ContractName, getContract as getContractInfo } from '@/contracts/contracts';
import { handleContractError } from '@/lib/web3-utils';
import { TransactionCallbacks, TransactionMetadata, defaultTransactionCallbacks } from '@/lib/transaction-callbacks';

// Cache sync client instances per wallet
const syncClientCache = new Map<string, RiseSyncClient>();

/**
 * Generic contract hook factory with optional payable support
 * Creates a type-safe hook for any contract in the project
 * 
 * @param contractName - The name of the contract from contracts.ts
 * @param options - Configuration options
 * @param options.isPayable - Whether the contract has payable functions (default: false)
 * @returns A hook function that provides contract interaction methods
 * 
 * @example
 * // Create a hook for a regular contract
 * export const useMyContract = createContractHook('MyContract');
 * 
 * // Create a hook for a contract with payable functions
 * export const useMyPayableContract = createContractHook('MyPayableContract', { isPayable: true });
 * 
 * // Use it in a component
 * const { read, write, isLoading } = useMyContract();
 * 
 * // For payable contracts, pass value in options
 * await write('myPayableFunction', [arg1, arg2], { value: '0.1' }); // 0.1 ETH
 */
export function createContractHook<T extends ContractName>(
  contractName: T,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: { isPayable?: boolean }
) {
  return function useContract() {
    const [isLoading, setIsLoading] = useState(false);
    const { connector } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { ensureCorrectNetwork } = useEnsureNetwork();
    
    // Get contract info
    const contractInfo = getContractInfo(contractName);
    const contractAddress = contractInfo.address;
    const contractABI = contractInfo.abi;

    const publicClient = usePublicClient();
    
    const getPublicClient = useCallback((): PublicClient => {
      return publicClient;
    }, [publicClient]);

    const getWalletClient = useCallback(async (): Promise<WalletClient> => {
      if (!walletClient) throw new Error('No wallet connected');
      
      // Ensure we're on the correct network first
      await ensureCorrectNetwork();
      
      // Check if it's an embedded wallet by checking the connector ID
      const isEmbeddedWallet = connector?.id === 'embedded-wallet';
      
      if (isEmbeddedWallet) {
        // For embedded wallet, create a wallet client with the private key
        const privateKey = localStorage.getItem('rise-embedded-wallet');
        if (!privateKey) throw new Error('Embedded wallet private key not found');
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        return createWalletClient({
          account,
          chain: RISE_TESTNET,
          transport: http(RISE_RPC_URL),
        });
      } else {
        // For external wallets, use the wagmi wallet client
        return walletClient;
      }
    }, [walletClient, connector, ensureCorrectNetwork]);

    // Helper to get contract params for viem
    const getContractParams = useCallback(() => {
      return {
        address: contractAddress as `0x${string}`,
        abi: contractABI as Abi,
      };
    }, [contractAddress, contractABI]);

    // Generic read function
    const read = useCallback(async (functionName: string, args: unknown[] = []) => {
      const publicClient = getPublicClient();
      const { address, abi } = getContractParams();
      
      const result = await publicClient.readContract({
        address,
        abi,
        functionName,
        args,
      });
      
      return result;
    }, [getPublicClient, getContractParams]);

    // Generic write function with optional payable support
    const write = useCallback(async (
      functionName: string, 
      args: unknown[] = [], 
      options?: { 
        value?: string | bigint; 
        gasLimit?: string | bigint;
        callbacks?: TransactionCallbacks;
        metadata?: TransactionMetadata;
      }
    ) => {
      setIsLoading(true);
      
      // Use provided callbacks or defaults
      const callbacks = options?.callbacks || defaultTransactionCallbacks;
      const metadata = options?.metadata || { action: functionName };
      
      // Call onTxSending callback
      callbacks.onTxSending?.(metadata);
      
      try {
        const isEmbeddedWallet = connector?.id === 'embedded-wallet';
        
        if (isEmbeddedWallet) {
          const privateKey = localStorage.getItem('rise-embedded-wallet');
          if (!privateKey) throw new Error('Embedded wallet private key not found');
          
          // Use cached sync client or create new one
          let syncClient = syncClientCache.get(privateKey);
          if (!syncClient) {
            syncClient = new RiseSyncClient(privateKey);
            syncClientCache.set(privateKey, syncClient);
          }
          
          const { abi } = getContractParams();
          
          const data = encodeFunctionData({
            abi,
            functionName,
            args,
          });
          
          
          const transactionOptions: {
            to: string;
            data: string;
            value?: string;
            gasLimit?: string;
          } = {
            to: contractAddress,
            data,
          };

          // Add payable options if provided and contract is payable
          if (options) {
            if (options.value !== undefined) {
              transactionOptions.value = options.value.toString();
            }
            if (options.gasLimit !== undefined) {
              transactionOptions.gasLimit = options.gasLimit.toString();
            }
          }
          
          // For embedded wallets, we get the receipt immediately
          const result = await syncClient.sendTransaction(transactionOptions);
          
          // Call onTxSent with the transaction hash
          if (result.transactionHash) {
            callbacks.onTxSent?.(result.transactionHash, metadata);
          }
          
          // Call onTxConfirmed with the receipt
          callbacks.onTxConfirmed?.(result, metadata);
          
          // Return consistent format that includes success indicator
          return {
            ...result,
            success: true,
            isSync: true
          };
        } else {
          // Use regular transaction flow for external wallets
          const walletClient = await getWalletClient();
          const publicClient = getPublicClient();
          const { address, abi } = getContractParams();
          
          // Build transaction request
          const baseRequest = {
            address,
            abi,
            functionName,
            args,
            account: walletClient.account!,
          };
          
          // Add value/gas options if provided
          const request = {
            ...baseRequest,
            ...(options?.value && {
              value: typeof options.value === 'string' 
                ? parseEther(options.value) 
                : options.value
            }),
            ...(options?.gasLimit && {
              gas: BigInt(options.gasLimit)
            })
          };
          
          // Simulate the transaction first
          const { request: simulatedRequest } = await publicClient.simulateContract(request);
          
          // Execute the transaction
          const hash = await walletClient.writeContract(simulatedRequest);
          
          // Call onTxSent with the transaction hash
          callbacks.onTxSent?.(hash, metadata);
          
          // Wait for confirmation
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          
          // Call onTxConfirmed with the receipt
          callbacks.onTxConfirmed?.(receipt, metadata);
          
          return {
            ...receipt,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber.toString(),
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status === 'success' ? 1 : 0,
            success: true,
            isSync: false
          };
        }
      } catch (error) {
        // Use our handleContractError utility for better error messages
        const errorInfo = handleContractError(error);
        const enhancedError = new Error(errorInfo.description || errorInfo.title);
        
        // Call onTxError callback
        callbacks.onTxError?.(enhancedError, metadata);
        
        throw enhancedError;
      } finally {
        setIsLoading(false);
      }
    }, [getWalletClient, getPublicClient, connector, contractAddress, getContractParams]);

    return {
      isLoading,
      read,
      write,
      contractAddress,
      contractName,
      // Expose lower level functions if needed
      getPublicClient,
      getWalletClient,
      getContractParams,
    };
  };
}

// Export the previous function names for backward compatibility
export const createContractHookPayable = <T extends ContractName>(contractName: T) => 
  createContractHook(contractName, { isPayable: true });