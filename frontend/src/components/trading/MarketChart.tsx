'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { usePriceCandles, type TimeInterval } from '@/hooks/api/usePriceCandles';
import { contracts } from '@/contracts/contracts';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketChartProps {
  pair: string;
}

export function MarketChart({ pair }: MarketChartProps) {
  const [timeframe, setTimeframe] = useState<TimeInterval>('15m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  
  // Get market address
  const marketAddress = contracts.EnhancedSpotBook.address;
  
  // Fetch real candle data
  const { candles, loading } = usePriceCandles(marketAddress, timeframe);

  const timeframes = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1H' },
    { value: '4h', label: '4H' },
    { value: '1d', label: '1D' },
  ];

  // Calculate chart dimensions
  const maxPrice = candles.length > 0 ? Math.max(...candles.map(c => c.high)) : 0;
  const minPrice = candles.length > 0 ? Math.min(...candles.map(c => c.low)) : 0;
  const priceRange = maxPrice - minPrice || 1; // Avoid division by zero

  return (
    <div className="h-full flex flex-col">
      {/* Chart Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">{pair}</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-1 text-xs rounded ${
                chartType === 'line' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={`px-2 py-1 text-xs rounded ${
                chartType === 'candle' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              Candles
            </button>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1">
          {timeframes.map(tf => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value as TimeInterval)}
              className={`px-2 py-1 text-xs rounded ${
                timeframe === tf.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 p-4 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No price data available for {timeframe} timeframe
          </div>
        ) : (
          <>
            {/* Simple candlestick visualization */}
            <div className="h-full flex items-end gap-px">
          {candles.slice(-50).map((candle, index) => {
            const isGreen = candle.close >= candle.open;
            const bodyHeight = Math.abs(candle.close - candle.open) / priceRange * 100;
            const bodyBottom = (Math.min(candle.close, candle.open) - minPrice) / priceRange * 100;
            const wickTop = (candle.high - minPrice) / priceRange * 100;
            const wickBottom = (candle.low - minPrice) / priceRange * 100;
            
            return (
              <div key={index} className="flex-1 relative h-full">
                {chartType === 'candle' ? (
                  <>
                    {/* Wick */}
                    <div
                      className="absolute w-px left-1/2 -translate-x-1/2 bg-gray-400"
                      style={{
                        bottom: `${wickBottom}%`,
                        height: `${wickTop - wickBottom}%`,
                      }}
                    />
                    {/* Body */}
                    <div
                      className={`absolute w-full ${
                        isGreen ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{
                        bottom: `${bodyBottom}%`,
                        height: `${bodyHeight}%`,
                        minHeight: '1px',
                      }}
                    />
                  </>
                ) : (
                  /* Line chart - just show close prices */
                  <div
                    className="absolute w-full h-px bg-blue-500"
                    style={{
                      bottom: `${((candle.close - minPrice) / priceRange) * 100}%`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Price Scale */}
        <div className="absolute right-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground">
          <span>${maxPrice.toFixed(0)}</span>
          <span>${((maxPrice + minPrice) / 2).toFixed(0)}</span>
          <span>${minPrice.toFixed(0)}</span>
        </div>

        {/* Current Price Indicator */}
        {candles.length > 0 && (
          <div 
            className="absolute left-0 right-8 flex items-center"
            style={{
              bottom: `${((candles[candles.length - 1].close - minPrice) / priceRange) * 100}%`,
            }}
          >
            <div className="w-full h-px bg-primary/50 border-t border-dashed border-primary" />
            <Badge className="ml-2 text-xs">
              ${candles[candles.length - 1].close.toFixed(2)}
            </Badge>
          </div>
        )}
          </>
        )}
      </div>

      {/* Volume indicator at bottom */}
      <div className="h-16 border-t px-4 py-2">
        {loading || candles.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <div className="h-full flex items-end gap-px">
          {candles.slice(-50).map((candle, index) => (
            <div
              key={index}
              className="flex-1 bg-muted"
              style={{
                height: `${(candle.volume / Math.max(...candles.map(c => c.volume))) * 100}%`,
              }}
            />
          ))}
          </div>
        )}
      </div>
    </div>
  );
}