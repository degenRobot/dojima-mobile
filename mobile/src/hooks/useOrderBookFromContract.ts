/**
 * Hook to fetch order book directly from the UnifiedCLOBV2 contract
 * This provides real-time order book data without relying on the indexer
 */

import { useState, useEffect, useCallback } from 'react';
import { encodeFunctionData, decodeFunctionResult, formatUnits, type Address } from 'viem';
import { CONTRACTS, TRADING_BOOKS, NETWORK_CONFIG } from '../config/contracts';
import { UnifiedCLOBV2ABI } from '../config/abis';
import { logDebug, logError, logInfo } from '../utils/logger';

interface Order {
  id: string;
  price: string;
  amount: string;
  total: string;
  maker: string;
}

interface OrderBook {
  buyOrders: Order[];
  sellOrders: Order[];
  spread: string;
  midPrice: string;
}

// Contract read helper
async function readContract(functionName: string, args: any[]): Promise<any> {
  try {
    const data = encodeFunctionData({
      abi: UnifiedCLOBV2ABI,
      functionName,
      args,
    });

    const response = await fetch(NETWORK_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: CONTRACTS.UnifiedCLOB.address,
          data,
        }, 'latest'],
        id: Date.now(),
      }),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message);
    }

    return decodeFunctionResult({
      abi: UnifiedCLOBV2ABI,
      functionName,
      data: result.result,
    });
  } catch (error) {
    logError('useOrderBookFromContract', `Failed to read ${functionName}`, { error });
    throw error;
  }
}

export function useOrderBookFromContract(bookId: number) {
  const [orderBook, setOrderBook] = useState<OrderBook>({
    buyOrders: [],
    sellOrders: [],
    spread: '0',
    midPrice: '0',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get book configuration
  const book = TRADING_BOOKS.find(b => b.id === bookId);
  const quoteDecimals = book?.quoteDecimals || 6;

  const fetchOrderBook = useCallback(async () => {
    if (!book) {
      setError('Invalid book ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      logDebug('useOrderBookFromContract', 'Fetching order book', { bookId });

      // Fetch buy and sell order IDs
      const [buyOrderIds] = await readContract('buyOrders', [bookId, 0]) as [bigint[]];
      const [sellOrderIds] = await readContract('sellOrders', [bookId, 0]) as [bigint[]];

      // Fetch order details for each order
      const buyOrderPromises = buyOrderIds.slice(0, 20).map(async (orderId) => {
        try {
          const [order] = await readContract('orders', [bookId, orderId]) as any[];
          if (!order || order.status !== 0) return null; // Only active orders
          
          const price = formatUnits(order.price, quoteDecimals);
          const amount = formatUnits(order.amount, 18); // Always 18 decimals for amount
          const total = (parseFloat(price) * parseFloat(amount)).toFixed(2);
          
          return {
            id: orderId.toString(),
            price,
            amount,
            total,
            maker: order.maker,
          };
        } catch (err) {
          logError('useOrderBookFromContract', 'Failed to fetch buy order', { orderId, error: err });
          return null;
        }
      });

      const sellOrderPromises = sellOrderIds.slice(0, 20).map(async (orderId) => {
        try {
          const [order] = await readContract('orders', [bookId, orderId]) as any[];
          if (!order || order.status !== 0) return null; // Only active orders
          
          const price = formatUnits(order.price, quoteDecimals);
          const amount = formatUnits(order.amount, 18); // Always 18 decimals for amount
          const total = (parseFloat(price) * parseFloat(amount)).toFixed(2);
          
          return {
            id: orderId.toString(),
            price,
            amount,
            total,
            maker: order.maker,
          };
        } catch (err) {
          logError('useOrderBookFromContract', 'Failed to fetch sell order', { orderId, error: err });
          return null;
        }
      });

      const [buyOrdersData, sellOrdersData] = await Promise.all([
        Promise.all(buyOrderPromises),
        Promise.all(sellOrderPromises),
      ]);

      // Filter out null values and sort
      const buyOrders = buyOrdersData
        .filter(o => o !== null) as Order[];
      const sellOrders = sellOrdersData
        .filter(o => o !== null) as Order[];

      // Sort buy orders by price descending (highest first)
      buyOrders.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      
      // Sort sell orders by price ascending (lowest first)
      sellOrders.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

      // Calculate spread and mid price
      const bestBid = buyOrders[0]?.price || '0';
      const bestAsk = sellOrders[0]?.price || '0';
      const spread = (parseFloat(bestAsk) - parseFloat(bestBid)).toFixed(2);
      const midPrice = bestBid && bestAsk ? 
        ((parseFloat(bestBid) + parseFloat(bestAsk)) / 2).toFixed(2) : '0';

      setOrderBook({
        buyOrders,
        sellOrders,
        spread,
        midPrice,
      });

      logInfo('useOrderBookFromContract', 'Order book fetched', {
        bookId,
        buyOrders: buyOrders.length,
        sellOrders: sellOrders.length,
        spread,
        midPrice,
      });

    } catch (error: any) {
      logError('useOrderBookFromContract', 'Failed to fetch order book', { error: error.message });
      setError(error.message || 'Failed to fetch order book');
      
      // Set empty order book on error
      setOrderBook({
        buyOrders: [],
        sellOrders: [],
        spread: '0',
        midPrice: '0',
      });
    } finally {
      setLoading(false);
    }
  }, [bookId, book, quoteDecimals]);

  // Fetch on mount and when bookId changes
  useEffect(() => {
    fetchOrderBook();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchOrderBook, 10000);
    
    return () => clearInterval(interval);
  }, [fetchOrderBook]);

  return {
    orderBook,
    loading,
    error,
    refetch: fetchOrderBook,
  };
}