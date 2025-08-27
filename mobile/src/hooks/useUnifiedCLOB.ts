/**
 * Hook for interacting with UnifiedCLOB contract
 * Handles decimal conversions and Porto gasless transactions
 */

import { useState, useCallback } from 'react';
import { encodeFunctionData } from 'viem';
import { usePorto } from '../providers/PortoProvider';
import { CONTRACTS, TRADING_BOOKS, getTokenBySymbol } from '../config/contracts';
import {
  formatAmountForContract,
  formatPriceForContract,
  formatOrderForContract,
  parseAmountFromContract,
  normalizeAmountForContract,
} from '../utils/contractDecimals';

// Import ABIs
import UnifiedCLOBABI from '../abis/UnifiedCLOB.json';
import MintableERC20ABI from '../abis/MintableERC20.json';

export const useUnifiedCLOB = () => {
  const { executeGaslessTransaction } = usePorto();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  /**
   * Mint demo tokens (one-time only)
   */
  const mintTokens = useCallback(async (tokenSymbol: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = getTokenBySymbol(tokenSymbol);
      if (!token) throw new Error(`Unknown token: ${tokenSymbol}`);

      const data = encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: 'mintOnce',
        args: [],
      });

      const result = await executeGaslessTransaction(token.address, data);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeGaslessTransaction]);

  /**
   * Approve CLOB to spend tokens
   */
  const approveToken = useCallback(async (tokenSymbol: string, amount?: bigint) => {
    setLoading(true);
    setError(null);

    try {
      const token = getTokenBySymbol(tokenSymbol);
      if (!token) throw new Error(`Unknown token: ${tokenSymbol}`);

      // Default to max approval if no amount specified
      const approvalAmount = amount || BigInt(2) ** BigInt(256) - BigInt(1);

      const data = encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: 'approve',
        args: [CONTRACTS.UnifiedCLOB.address, approvalAmount],
      });

      const result = await executeGaslessTransaction(token.address, data);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeGaslessTransaction]);

  /**
   * Deposit tokens to CLOB
   */
  const deposit = useCallback(async (tokenSymbol: string, humanAmount: number) => {
    setLoading(true);
    setError(null);

    try {
      const token = getTokenBySymbol(tokenSymbol);
      if (!token) throw new Error(`Unknown token: ${tokenSymbol}`);

      // Use 18-decimal normalization for contract
      const amount = formatAmountForContract(humanAmount, tokenSymbol);

      const data = encodeFunctionData({
        abi: UnifiedCLOBABI,
        functionName: 'deposit',
        args: [token.address, amount],
      });

      const result = await executeGaslessTransaction(CONTRACTS.UnifiedCLOB.address, data);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeGaslessTransaction]);

  /**
   * Withdraw tokens from CLOB
   */
  const withdraw = useCallback(async (tokenSymbol: string, humanAmount: number) => {
    setLoading(true);
    setError(null);

    try {
      const tokenAddress = CONTRACTS[tokenSymbol as keyof typeof CONTRACTS];
      if (!tokenAddress) throw new Error(`Unknown token: ${tokenSymbol}`);

      // Use 18-decimal normalization for contract
      const amount = formatAmountForContract(humanAmount, tokenSymbol);

      const data = encodeFunctionData({
        abi: UnifiedCLOBABI,
        functionName: 'withdraw',
        args: [tokenAddress, amount],
      });

      const result = await executeGaslessTransaction(CONTRACTS.UnifiedCLOB.address, data);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeGaslessTransaction]);

  /**
   * Place an order on the CLOB
   * @param bookId Trading book ID (1: WETH/USDC, 2: WBTC/USDC, 3: WETH/WBTC)
   * @param isBuy True for buy order, false for sell
   * @param humanPrice Human-readable price (e.g., 2000 for 2000 USDC per WETH)
   * @param humanAmount Human-readable amount of base token (e.g., 0.1 for 0.1 WETH)
   */
  const placeOrder = useCallback(async (
    bookId: number,
    isBuy: boolean,
    humanPrice: number,
    humanAmount: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Use proper decimal formatting for contract
      const { amount, price, quoteAmount, book } = formatOrderForContract(
        bookId,
        isBuy,
        humanPrice,
        humanAmount
      );

      console.log(`📊 Placing ${isBuy ? 'BUY' : 'SELL'} order on ${book.symbol}`);
      
      // Log quote amount for buy orders
      if (isBuy) {
        console.log(`   Quote needed: ${quoteAmount.toString()} (${book.quote} smallest unit)`);
      }

      const orderType = isBuy ? 0 : 1; // 0 = BUY, 1 = SELL

      const data = encodeFunctionData({
        abi: UnifiedCLOBABI,
        functionName: 'placeOrder',
        args: [bookId, orderType, price, amount],
      });

      const result = await executeGaslessTransaction(CONTRACTS.UnifiedCLOB.address, data);
      
      // TODO: Decode OrderPlaced event to get order ID
      
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeGaslessTransaction]);

  /**
   * Cancel an order
   */
  const cancelOrder = useCallback(async (orderId: number) => {
    setLoading(true);
    setError(null);

    try {
      const data = encodeFunctionData({
        abi: UnifiedCLOBABI,
        functionName: 'cancelOrder',
        args: [BigInt(orderId)],
      });

      const result = await executeGaslessTransaction(CONTRACTS.UnifiedCLOB.address, data);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executeGaslessTransaction]);

  /**
   * Get user's CLOB balance (view function - needs RPC call)
   */
  const getBalance = useCallback(async (userAddress: string, tokenSymbol: string) => {
    const token = getTokenBySymbol(tokenSymbol);
    if (!token) throw new Error(`Unknown token: ${tokenSymbol}`);

    // TODO: Implement RPC call to get balance
    // This needs to call UnifiedCLOB.getBalance(userAddress, token.address)
    // Returns { available: bigint, locked: bigint }
    
    return { available: BigInt(0), locked: BigInt(0) };
  }, []);

  /**
   * Get order book for a trading pair (view function - needs RPC call)
   */
  const getOrderBook = useCallback(async (bookId: number) => {
    // TODO: Implement RPC call to get order book
    // This needs to call UnifiedCLOB.getOrderBook(bookId)
    // Returns { buyOrders: bigint[], sellOrders: bigint[] }
    
    return { buyOrders: [], sellOrders: [] };
  }, []);

  return {
    // Actions
    mintTokens,
    approveToken,
    deposit,
    withdraw,
    placeOrder,
    cancelOrder,
    
    // View functions
    getBalance,
    getOrderBook,
    
    // State
    loading,
    error,
  };
};