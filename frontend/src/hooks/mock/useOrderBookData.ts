import { useState, useEffect } from 'react';

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
  percentage: number;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  lastPrice: number;
  lastPriceChange24h: number;
}

// Generate realistic order book data
const generateOrderBookLevels = (
  basePrice: number,
  side: 'bid' | 'ask',
  levels: number = 15
): OrderBookLevel[] => {
  const orders: OrderBookLevel[] = [];
  let cumulativeTotal = 0;
  
  for (let i = 0; i < levels; i++) {
    const priceOffset = (i + 1) * 0.5;
    const price = side === 'bid' 
      ? basePrice - priceOffset 
      : basePrice + priceOffset;
    
    // Generate realistic amounts with some randomness
    const amount = Math.random() * 5 + 0.1;
    cumulativeTotal += amount;
    
    orders.push({
      price: Number(price.toFixed(2)),
      amount: Number(amount.toFixed(6)),
      total: Number(cumulativeTotal.toFixed(6)),
      percentage: 0, // Will be calculated after all levels are generated
    });
  }
  
  // Calculate percentages
  const maxTotal = orders[orders.length - 1].total;
  orders.forEach(order => {
    order.percentage = (order.total / maxTotal) * 100;
  });
  
  return orders;
};

export function useOrderBookData(pair: string) {
  const [data, setData] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // TODO: Replace with real WebSocket connection to order book updates
    // const ws = new WebSocket(`wss://api.dojima.com/orderbook/${pair}`);
    
    // Simulate initial data load
    const loadOrderBook = () => {
      try {
        const basePrice = pair === 'WETH/USDC' ? 2150 : 100; // Mock prices
        const bids = generateOrderBookLevels(basePrice, 'bid');
        const asks = generateOrderBookLevels(basePrice, 'ask');
        
        const spread = asks[0].price - bids[0].price;
        const spreadPercent = (spread / bids[0].price) * 100;
        
        setData({
          bids,
          asks,
          spread: Number(spread.toFixed(2)),
          spreadPercent: Number(spreadPercent.toFixed(4)),
          lastPrice: basePrice,
          lastPriceChange24h: 2.5, // Mock 24h change
        });
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };

    loadOrderBook();

    // Simulate real-time updates
    const interval = setInterval(() => {
      // Randomly update a few price levels
      setData(prevData => {
        if (!prevData) return null;
        
        const newBids = [...prevData.bids];
        const newAsks = [...prevData.asks];
        
        // Update 2-3 random levels
        const updatesCount = Math.floor(Math.random() * 2) + 2;
        
        for (let i = 0; i < updatesCount; i++) {
          const bidIndex = Math.floor(Math.random() * 5); // Update top 5 levels
          const askIndex = Math.floor(Math.random() * 5);
          
          if (newBids[bidIndex]) {
            newBids[bidIndex] = {
              ...newBids[bidIndex],
              amount: Number((Math.random() * 5 + 0.1).toFixed(6)),
            };
          }
          
          if (newAsks[askIndex]) {
            newAsks[askIndex] = {
              ...newAsks[askIndex],
              amount: Number((Math.random() * 5 + 0.1).toFixed(6)),
            };
          }
        }
        
        // Recalculate totals
        let bidTotal = 0;
        newBids.forEach(bid => {
          bidTotal += bid.amount;
          bid.total = Number(bidTotal.toFixed(6));
        });
        
        let askTotal = 0;
        newAsks.forEach(ask => {
          askTotal += ask.amount;
          ask.total = Number(askTotal.toFixed(6));
        });
        
        // Recalculate percentages
        const maxBidTotal = newBids[newBids.length - 1].total;
        const maxAskTotal = newAsks[newAsks.length - 1].total;
        
        newBids.forEach(bid => {
          bid.percentage = (bid.total / maxBidTotal) * 100;
        });
        
        newAsks.forEach(ask => {
          ask.percentage = (ask.total / maxAskTotal) * 100;
        });
        
        return {
          ...prevData,
          bids: newBids,
          asks: newAsks,
        };
      });
    }, 2000); // Update every 2 seconds

    return () => {
      clearInterval(interval);
      // TODO: Close WebSocket connection
      // ws.close();
    };
  }, [pair]);

  return { data, loading, error };
}