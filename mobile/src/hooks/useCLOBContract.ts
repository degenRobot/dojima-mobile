/**
 * Hook for interacting with UnifiedCLOBV2 contract
 * Uses Porto relay for gasless transactions
 */

import { useState, useCallback } from 'react';
import { encodeFunctionData, parseUnits, formatUnits, type Address, type Hex } from 'viem';
import { usePorto } from '../providers/SimplePortoProvider';
import { CONTRACTS, TRADING_BOOKS } from '../config/contracts';
import { MintableERC20ABI, UnifiedCLOBV2ABI } from '../config/abis';

// Hardcoded prices for MVP
export const HARDCODED_PRICES = {
  WETH: 2500,  // $2,500 per ETH
  WBTC: 65000, // $65,000 per BTC
  USDC: 1,     // $1 per USDC
};

interface TransactionResult {
  success: boolean;
  bundleId?: string;
  error?: string;
}

export function useCLOBContract() {
  const { executeTransaction, userAddress } = usePorto();
  const [loading, setLoading] = useState(false);

  /**
   * Mint test tokens (one-time mint)
   */
  const mintTokens = useCallback(async (
    tokenSymbol: 'USDC' | 'WETH' | 'WBTC',
    amount: string
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      const token = CONTRACTS[tokenSymbol];
      
      // Convert amount to proper decimals
      const amountBigInt = parseUnits(amount, token.decimals);
      
      // Encode mint function
      const data = encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: 'mintOnce',
        args: [],
      });

      console.log(`Minting ${amount} ${tokenSymbol}...`);
      const result = await executeTransaction(token.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Mint failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress]);

  /**
   * Approve token for CLOB spending
   */
  const approveToken = useCallback(async (
    tokenSymbol: 'USDC' | 'WETH' | 'WBTC',
    amount: string
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      const token = CONTRACTS[tokenSymbol];
      const amountBigInt = parseUnits(amount, token.decimals);
      
      const data = encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: 'approve',
        args: [CONTRACTS.UnifiedCLOB.address, amountBigInt],
      });

      console.log(`Approving ${amount} ${tokenSymbol} for CLOB...`);
      const result = await executeTransaction(token.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Approve failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress]);

  /**
   * Deposit tokens to CLOB
   */
  const depositToCLOB = useCallback(async (
    tokenSymbol: 'USDC' | 'WETH' | 'WBTC',
    amount: string
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      const token = CONTRACTS[tokenSymbol];
      const amountBigInt = parseUnits(amount, token.decimals);
      
      // First approve if needed
      const approveResult = await approveToken(tokenSymbol, amount);
      if (!approveResult.success) {
        return approveResult;
      }

      // Then deposit
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'deposit',
        args: [token.address, amountBigInt],
      });

      console.log(`Depositing ${amount} ${tokenSymbol} to CLOB...`);
      const result = await executeTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Deposit failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress, approveToken]);

  /**
   * Withdraw tokens from CLOB
   */
  const withdrawFromCLOB = useCallback(async (
    tokenSymbol: 'USDC' | 'WETH' | 'WBTC',
    amount: string
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      const token = CONTRACTS[tokenSymbol];
      const amountBigInt = parseUnits(amount, token.decimals);
      
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'withdraw',
        args: [token.address, amountBigInt],
      });

      console.log(`Withdrawing ${amount} ${tokenSymbol} from CLOB...`);
      const result = await executeTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Withdraw failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress]);

  /**
   * Place an order on the CLOB
   */
  const placeOrder = useCallback(async (
    bookId: number,
    isBuy: boolean,
    price: string,
    amount: string
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      
      // Get book info
      const book = TRADING_BOOKS.find(b => b.id === bookId);
      if (!book) {
        return { success: false, error: 'Invalid book ID' };
      }

      // Convert price to quote token decimals
      const priceBigInt = parseUnits(price, book.quoteDecimals);
      
      // Amount is always normalized to 18 decimals for the contract
      const amountBigInt = parseUnits(amount, 18);
      
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'placeOrder',
        args: [
          bookId,
          isBuy ? 0 : 1, // 0 = buy, 1 = sell
          priceBigInt,
          amountBigInt,
        ],
      });

      console.log(`Placing ${isBuy ? 'buy' : 'sell'} order: ${amount} @ ${price} on book ${bookId}...`);
      const result = await executeTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Place order failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress]);

  /**
   * Place a market order on the CLOB with slippage protection
   */
  const placeMarketOrder = useCallback(async (
    bookId: number,
    isBuy: boolean,
    amount: string,
    slippageBps: number = 100 // Default 1% slippage (100 basis points)
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      
      // Get book info
      const book = TRADING_BOOKS.find(b => b.id === bookId);
      if (!book) {
        return { success: false, error: 'Invalid book ID' };
      }

      // Amount is always normalized to 18 decimals for the contract
      const amountBigInt = parseUnits(amount, 18);
      
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'placeMarketOrder',
        args: [
          bookId,
          isBuy ? 0 : 1, // 0 = buy, 1 = sell
          amountBigInt,
          slippageBps, // Slippage in basis points (100 = 1%)
        ],
      });

      console.log(`Placing market ${isBuy ? 'buy' : 'sell'} order: ${amount} with ${slippageBps/100}% slippage on book ${bookId}...`);
      const result = await executeTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Market order failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress]);

  /**
   * Cancel an order
   */
  const cancelOrder = useCallback(async (
    bookId: number,
    orderId: bigint
  ): Promise<TransactionResult> => {
    if (!userAddress) {
      return { success: false, error: 'No wallet address' };
    }

    try {
      setLoading(true);
      
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'cancelOrder',
        args: [bookId, orderId],
      });

      console.log(`Canceling order ${orderId} on book ${bookId}...`);
      const result = await executeTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Cancel order failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction, userAddress]);

  /**
   * Match orders on a book
   */
  const matchOrders = useCallback(async (
    bookId: number
  ): Promise<TransactionResult> => {
    try {
      setLoading(true);
      
      const data = encodeFunctionData({
        abi: UnifiedCLOBV2ABI,
        functionName: 'matchOrders',
        args: [bookId],
      });

      console.log(`Matching orders on book ${bookId}...`);
      const result = await executeTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      return { 
        success: true, 
        bundleId: result.bundleId 
      };
    } catch (error: any) {
      console.error('Match orders failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [executeTransaction]);

  /**
   * Calculate USD value of a token amount
   */
  const calculateUSDValue = useCallback((
    tokenSymbol: 'USDC' | 'WETH' | 'WBTC',
    amount: string
  ): number => {
    const price = HARDCODED_PRICES[tokenSymbol];
    const numAmount = parseFloat(amount);
    return price * numAmount;
  }, []);

  return {
    // State
    loading,
    
    // Token operations
    mintTokens,
    approveToken,
    depositToCLOB,
    withdrawFromCLOB,
    
    // Trading operations
    placeOrder,
    placeMarketOrder,
    cancelOrder,
    matchOrders,
    
    // Utilities
    calculateUSDValue,
    HARDCODED_PRICES,
  };
}