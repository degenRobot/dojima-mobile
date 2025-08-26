'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAnalyticsData } from '@/hooks/mock/useAnalyticsData';
import { useState } from 'react';

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const { data, loading } = useAnalyticsData(timeframe);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold japanese-heading">Analytics</h1>
        
        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'japanese-button-primary'
                  : 'japanese-button'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      
      {/* Protocol Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Total Value Locked</h3>
          <p className="text-2xl font-bold">${data?.tvl.toLocaleString() || '-'}</p>
          <p className={`text-sm ${data?.tvlChange && data.tvlChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data?.tvlChange ? `${data.tvlChange >= 0 ? '+' : ''}${data.tvlChange.toFixed(2)}%` : '-'}
          </p>
        </Card>
        
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Volume</h3>
          <p className="text-2xl font-bold">${data?.volume.toLocaleString() || '-'}</p>
          <p className={`text-sm ${data?.volumeChange && data.volumeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data?.volumeChange ? `${data.volumeChange >= 0 ? '+' : ''}${data.volumeChange.toFixed(2)}%` : '-'}
          </p>
        </Card>
        
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Total Fees</h3>
          <p className="text-2xl font-bold">${data?.fees.toLocaleString() || '-'}</p>
          <p className="text-sm text-muted-foreground">
            {data?.feeAPR ? `${data.feeAPR.toFixed(2)}% APR` : '-'}
          </p>
        </Card>
        
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Active Users</h3>
          <p className="text-2xl font-bold">{data?.activeUsers.toLocaleString() || '-'}</p>
          <p className={`text-sm ${data?.userChange && data.userChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data?.userChange ? `${data.userChange >= 0 ? '+' : ''}${data.userChange.toFixed(2)}%` : '-'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Volume Chart Placeholder */}
        <Card className="p-6 japanese-card">
          <h2 className="text-xl font-semibold mb-4">Volume Overview</h2>
          <div className="h-64 flex items-center justify-center bg-muted/20 rounded">
            <p className="text-muted-foreground">
              {/* TODO: Integrate with charting library (recharts/chart.js) */}
              Volume chart visualization
            </p>
          </div>
        </Card>

        {/* TVL Chart Placeholder */}
        <Card className="p-6 japanese-card">
          <h2 className="text-xl font-semibold mb-4">TVL Trend</h2>
          <div className="h-64 flex items-center justify-center bg-muted/20 rounded">
            <p className="text-muted-foreground">
              {/* TODO: Integrate with charting library (recharts/chart.js) */}
              TVL trend visualization
            </p>
          </div>
        </Card>
      </div>

      {/* Top Pairs Table */}
      <Card className="japanese-card overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Top Trading Pairs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-4 font-medium text-sm">Pair</th>
                <th className="p-4 font-medium text-sm">Volume</th>
                <th className="p-4 font-medium text-sm">Trades</th>
                <th className="p-4 font-medium text-sm">Fees Generated</th>
                <th className="p-4 font-medium text-sm">Liquidity</th>
                <th className="p-4 font-medium text-sm">APR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading analytics...
                  </td>
                </tr>
              ) : (
                data?.topPairs.map((pair, index) => (
                  <tr key={pair.symbol} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{pair.symbol}</span>
                        {index < 3 && (
                          <Badge variant="secondary" className="text-xs">
                            Top {index + 1}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">${pair.volume.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span>{pair.trades.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">${pair.fees.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">${pair.liquidity.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-green-600 font-semibold">
                        {pair.apr.toFixed(2)}%
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