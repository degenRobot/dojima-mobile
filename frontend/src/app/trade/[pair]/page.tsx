'use client';

import { useParams } from 'next/navigation';
import { TradingLayout } from '@/components/trading/TradingLayout';
import { PairSelector } from '@/components/trading/PairSelector';
import { OrderForm } from '@/components/trading/OrderForm';
import { OrderBook } from '@/components/trading/OrderBook';
import { MarketChart } from '@/components/trading/MarketChart';
import { UserOrdersPanel } from '@/components/trading/UserOrdersPanel';
import { DepositWithdraw } from '@/components/trading/DepositWithdraw';
import { Card } from '@/components/ui/card';
import { useRecentTrades, useMarketStats } from '@/hooks/api/useRecentTrades';
import { contracts } from '@/contracts/contracts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

export default function TradePage() {
  const params = useParams();
  const pair = (params.pair as string) || 'WETH-USDC';
  
  // Get the market address
  const marketAddress = contracts['EnhancedSpotBook']?.address || '';
  
  // Get real market data
  const { trades, loading: tradesLoading } = useRecentTrades(marketAddress);
  const { stats, loading: statsLoading } = useMarketStats(marketAddress);

  return (
    <TradingLayout>
      {/* Top Bar with Pair Selector */}
      <div className="h-16 border-b flex items-center px-4">
        <PairSelector currentPair={pair} />
      </div>

      {/* Main Trading Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Left Panel - Order Form */}
        <div className="col-span-3 space-y-4">
          <Card className="p-4 japanese-card">
            <OrderForm pair={pair} />
          </Card>
          <DepositWithdraw />
        </div>

        {/* Middle Panel - Chart */}
        <div className="col-span-6">
          <Card className="h-full japanese-card overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <MarketChart pair={pair} />
              </div>
              <div className="h-[300px] border-t">
                <OrderBook pair={pair} />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Market Info */}
        <div className="col-span-3 space-y-4">
          <Card className="p-4 japanese-card">
            <h3 className="font-semibold mb-3">Market Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">24h Volume</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span className="font-mono">
                    ${stats?.volume24h ? stats.volume24h.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                  </span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">24h High</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span className="font-mono">
                    ${stats?.high24h ? stats.high24h.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                  </span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">24h Low</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span className="font-mono">
                    ${stats?.low24h ? stats.low24h.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                  </span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Price</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span className="font-mono">
                    ${stats?.lastPrice ? stats.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                  </span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">24h Change</span>
                {statsLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span className={`font-mono ${stats?.priceChange24h && stats.priceChange24h > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats?.priceChange24h ? `${stats.priceChange24h > 0 ? '+' : ''}${stats.priceChange24h.toFixed(2)}%` : '0%'}
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-4 japanese-card">
            <h3 className="font-semibold mb-3">Recent Trades</h3>
            <div className="space-y-1 text-sm max-h-[200px] overflow-y-auto">
              {tradesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : trades.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No recent trades
                </div>
              ) : (
                trades.slice(0, 20).map((trade) => (
                  <div
                    key={trade.id}
                    className={`flex justify-between items-center py-1 ${trade.side === 'buy' ? 'text-green-600' : 'text-red-600'}`}
                  >
                    <span className="font-mono">
                      {trade.price.toFixed(2)}
                    </span>
                    <span className="font-mono">
                      {trade.amount.toFixed(4)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Panel - User Orders */}
      <div className="h-[250px] border-t">
        <UserOrdersPanel />
      </div>
    </TradingLayout>
  );
}