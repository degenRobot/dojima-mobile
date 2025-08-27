import { useState } from 'react';
import { parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { publicClient, walletClient } from '../config/viemClient';
import { CONTRACTS } from '../config/contracts';
import { useWalletStore } from '../store/walletStore';
import { usePorto } from '../providers/PortoProvider';

interface PlaceOrderParams {
  bookId: number;
  isBuy: boolean;
  price: string;
  amount: string;
  baseDecimals: number;
  quoteDecimals: number;
}

export function useOrderPlacement() {
  const { wallet } = useWalletStore();
  const { executeTransaction } = usePorto();
  const [isPlacing, setIsPlacing] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<bigint | null>(null);

  const placeOrder = async (params: PlaceOrderParams): Promise<bigint | null> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    const {
      bookId,
      isBuy,
      price,
      amount,
      baseDecimals,
      quoteDecimals,
    } = params;

    setIsPlacing(true);
    try {
      // Format price for contract (always in quote decimals)
      const priceForContract = parseUnits(price, quoteDecimals);
      
      // Format amount for contract (always normalized to 18 decimals)
      const amountForContract = parseUnits(amount, 18);

      console.log('Placing order:', {
        bookId,
        orderType: isBuy ? 'BUY' : 'SELL',
        price: price,
        amount: amount,
        priceForContract: priceForContract.toString(),
        amountForContract: amountForContract.toString(),
      });

      // Use Porto gasless transaction if available, otherwise use standard
      let hash: `0x${string}`;
      
      if (executeTransaction) {
        // Porto gasless transaction
        const data = walletClient.encodeFunctionData({
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'placeOrder',
          args: [
            BigInt(bookId),
            isBuy ? 0 : 1, // OrderType enum
            priceForContract,
            amountForContract,
          ],
        });

        const result = await executeTransaction({
          to: CONTRACTS.UnifiedCLOB.address,
          data,
          value: 0n,
        });

        hash = result.hash;
      } else {
        // Standard transaction
        const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
        
        hash = await walletClient.writeContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'placeOrder',
          args: [
            BigInt(bookId),
            isBuy ? 0 : 1,
            priceForContract,
            amountForContract,
          ],
          account,
        });
      }

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Parse OrderPlaced event to get order ID
      let orderId: bigint | null = null;
      
      for (const log of receipt.logs) {
        try {
          const decoded = walletClient.decodeEventLog({
            abi: CONTRACTS.UnifiedCLOB.abi,
            data: log.data,
            topics: log.topics,
          });
          
          if (decoded.eventName === 'OrderPlaced') {
            orderId = decoded.args.orderId as bigint;
            console.log('Order placed successfully with ID:', orderId.toString());
            break;
          }
        } catch {
          // Not the event we're looking for
        }
      }

      setLastOrderId(orderId);
      return orderId;
    } catch (error: any) {
      console.error('Failed to place order:', error);
      throw new Error(error.message || 'Failed to place order');
    } finally {
      setIsPlacing(false);
    }
  };

  const cancelOrder = async (orderId: bigint): Promise<boolean> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      let hash: `0x${string}`;
      
      if (executeTransaction) {
        // Porto gasless transaction
        const data = walletClient.encodeFunctionData({
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'cancelOrder',
          args: [orderId],
        });

        const result = await executeTransaction({
          to: CONTRACTS.UnifiedCLOB.address,
          data,
          value: 0n,
        });

        hash = result.hash;
      } else {
        // Standard transaction
        const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
        
        hash = await walletClient.writeContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'cancelOrder',
          args: [orderId],
          account,
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });
      console.log('Order cancelled successfully:', orderId.toString());
      return true;
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      throw new Error(error.message || 'Failed to cancel order');
    }
  };

  const matchOrders = async (bookId: number, maxMatches: number = 10): Promise<number> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      let hash: `0x${string}`;
      
      if (executeTransaction) {
        // Porto gasless transaction
        const data = walletClient.encodeFunctionData({
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'matchOrders',
          args: [BigInt(bookId), BigInt(maxMatches)],
        });

        const result = await executeTransaction({
          to: CONTRACTS.UnifiedCLOB.address,
          data,
          value: 0n,
        });

        hash = result.hash;
      } else {
        // Standard transaction
        const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
        
        hash = await walletClient.writeContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'matchOrders',
          args: [BigInt(bookId), BigInt(maxMatches)],
          account,
        });
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Count OrderMatched events
      let matchCount = 0;
      for (const log of receipt.logs) {
        try {
          const decoded = walletClient.decodeEventLog({
            abi: CONTRACTS.UnifiedCLOB.abi,
            data: log.data,
            topics: log.topics,
          });
          
          if (decoded.eventName === 'OrderMatched') {
            matchCount++;
          }
        } catch {
          // Not the event we're looking for
        }
      }

      console.log(`Matched ${matchCount} orders`);
      return matchCount;
    } catch (error: any) {
      console.error('Failed to match orders:', error);
      throw new Error(error.message || 'Failed to match orders');
    }
  };

  return {
    placeOrder,
    cancelOrder,
    matchOrders,
    isPlacing,
    lastOrderId,
  };
}