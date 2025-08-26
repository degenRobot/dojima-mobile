'use client';

import { useState } from 'react';
import { useOrderBook } from '@/hooks/api/useOrderBook';
import { Badge } from '@/components/ui/badge';
import { contracts } from '@/contracts/contracts';

interface OrderBookProps {
  pair: string;
}

export function OrderBook({ }: OrderBookProps) {
  // For now, we'll use the deployed EnhancedSpotBook address
  // TODO: In the future, lookup the correct market address based on the pair
  const marketAddress = contracts.EnhancedSpotBook.address;
  const { data, loading, error } = useOrderBook(marketAddress);
  const [displayMode, setDisplayMode] = useState<'book' | 'depth'>('book');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading order book...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">Error loading order book</p>
      </div>
    );
  }

  if (!data || (data.bids.length === 0 && data.asks.length === 0)) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Order Book</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-2">No orders in the book yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Be the first to place an order!</p>
          </div>
        </div>
      </div>
    );
  }

  const { bids, asks, spread, spreadPercent, lastPrice } = data;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold">Order Book</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Spread: {spread.toFixed(2)} ({spreadPercent.toFixed(2)}%)
          </Badge>
          <div className="flex gap-1">
            <button
              onClick={() => setDisplayMode('book')}
              className={`px-2 py-1 text-xs rounded ${
                displayMode === 'book' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              Book
            </button>
            <button
              onClick={() => setDisplayMode('depth')}
              className={`px-2 py-1 text-xs rounded ${
                displayMode === 'depth' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              Depth
            </button>
          </div>
        </div>
      </div>

      {/* Order Book Display */}
      {displayMode === 'book' ? (
        <div className="flex-1 flex">
          {/* Bids */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 bg-muted text-xs font-medium flex justify-between">
              <span>Price (USDC)</span>
              <span>Amount</span>
              <span>Total</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {bids.map((bid, index) => (
                <div
                  key={index}
                  className="px-3 py-1 text-xs font-mono flex justify-between hover:bg-green-50 dark:hover:bg-green-900/20 relative"
                >
                  <div
                    className="absolute inset-0 bg-green-500/10"
                    style={{ width: `${bid.percentage}%` }}
                  />
                  <span className="relative text-green-600">{bid.price.toFixed(2)}</span>
                  <span className="relative">{bid.amount.toFixed(4)}</span>
                  <span className="relative text-gray-600 dark:text-gray-400">{bid.total.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-border" />

          {/* Asks */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 bg-muted text-xs font-medium flex justify-between">
              <span>Price (USDC)</span>
              <span>Amount</span>
              <span>Total</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {asks.map((ask, index) => (
                <div
                  key={index}
                  className="px-3 py-1 text-xs font-mono flex justify-between hover:bg-red-50 dark:hover:bg-red-900/20 relative"
                >
                  <div
                    className="absolute inset-0 bg-red-500/10"
                    style={{ width: `${ask.percentage}%` }}
                  />
                  <span className="relative text-red-600">{ask.price.toFixed(2)}</span>
                  <span className="relative">{ask.amount.toFixed(4)}</span>
                  <span className="relative text-gray-600 dark:text-gray-400">{ask.total.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4">
          {/* Depth Chart Visualization */}
          <div className="h-full flex items-end relative">
            {/* Bid depth bars */}
            <div className="flex-1 flex items-end gap-px">
              {bids.map((bid, index) => (
                <div
                  key={index}
                  className="flex-1 bg-green-500/30 hover:bg-green-500/50 transition-colors"
                  style={{ height: `${bid.percentage}%` }}
                  title={`${bid.price.toFixed(2)}: ${bid.total.toFixed(4)}`}
                />
              ))}
            </div>
            
            {/* Mid price line */}
            <div className="w-px h-full bg-foreground/20" />
            
            {/* Ask depth bars */}
            <div className="flex-1 flex items-end gap-px">
              {asks.map((ask, index) => (
                <div
                  key={index}
                  className="flex-1 bg-red-500/30 hover:bg-red-500/50 transition-colors"
                  style={{ height: `${ask.percentage}%` }}
                  title={`${ask.price.toFixed(2)}: ${ask.total.toFixed(4)}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Last Price */}
      <div className="p-2 border-t text-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">Last Price: </span>
        <span className="font-mono font-semibold">${lastPrice.toFixed(2)}</span>
      </div>
    </div>
  );
}