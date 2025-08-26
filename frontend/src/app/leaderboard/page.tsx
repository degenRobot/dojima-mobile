'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLeaderboardData } from '@/hooks/mock/useLeaderboardData';

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const { data, loading } = useLeaderboardData(timeframe);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold japanese-heading">Leaderboard</h1>
        
        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'japanese-button-primary'
                  : 'japanese-button'
              }`}
            >
              {tf === 'all' ? 'All Time' : tf}
            </button>
          ))}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Total Traders</h3>
          <p className="text-2xl font-bold">{data?.stats.totalTraders.toLocaleString() || '-'}</p>
        </Card>
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Total Volume</h3>
          <p className="text-2xl font-bold">${data?.stats.totalVolume.toLocaleString() || '-'}</p>
        </Card>
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Total Trades</h3>
          <p className="text-2xl font-bold">{data?.stats.totalTrades.toLocaleString() || '-'}</p>
        </Card>
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Avg. PnL</h3>
          <p className="text-2xl font-bold text-green-600">
            +{data?.stats.avgPnL.toFixed(2) || '0'}%
          </p>
        </Card>
      </div>

      {/* Leaderboard Table */}
      <Card className="japanese-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-4 font-medium text-sm">Rank</th>
                <th className="p-4 font-medium text-sm">Trader</th>
                <th className="p-4 font-medium text-sm">PnL</th>
                <th className="p-4 font-medium text-sm">Win Rate</th>
                <th className="p-4 font-medium text-sm">Volume</th>
                <th className="p-4 font-medium text-sm">Trades</th>
                <th className="p-4 font-medium text-sm">Best Trade</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading leaderboard...
                  </td>
                </tr>
              ) : (
                data?.traders.map((trader) => (
                  <tr key={trader.address} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg">{trader.rank}</span>
                        {trader.rank <= 3 && (
                          <span className="text-xl">
                            {trader.rank === 1 && '🥇'}
                            {trader.rank === 2 && '🥈'}
                            {trader.rank === 3 && '🥉'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {trader.address.slice(0, 6)}...{trader.address.slice(-4)}
                        </span>
                        {trader.isVerified && (
                          <Badge variant="secondary" className="text-xs">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${
                        trader.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trader.pnl >= 0 ? '+' : ''}{trader.pnl.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <span>{trader.winRate.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">
                          ({trader.wins}W/{trader.losses}L)
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">${trader.volume.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span>{trader.totalTrades}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-green-600 font-mono">
                        +${trader.bestTrade.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}