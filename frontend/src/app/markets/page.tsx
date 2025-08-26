'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRealMarketsData } from '@/hooks/useRealMarketsData';
import { useRouter } from 'next/navigation';

export default function MarketsPage() {
  const [filter, setFilter] = useState<'all' | 'spot' | 'perps'>('all');
  const { data, loading } = useRealMarketsData();
  const router = useRouter();

  const filteredMarkets = data?.markets.filter(market => 
    filter === 'all' || market.type === filter
  ) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold japanese-heading">Markets</h1>
        
        {/* Market Type Filter */}
        <div className="flex gap-2">
          {(['all', 'spot', 'perps'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === type
                  ? 'japanese-button-primary'
                  : 'japanese-button'
              }`}
            >
              {type === 'all' ? 'All Markets' : type === 'spot' ? 'Spot' : 'Perpetuals'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Total Markets</h3>
          <p className="text-2xl font-bold">{data?.stats.totalMarkets || '-'}</p>
        </Card>
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">24h Volume</h3>
          <p className="text-2xl font-bold">${data?.stats.total24hVolume.toLocaleString() || '-'}</p>
        </Card>
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">Open Interest</h3>
          <p className="text-2xl font-bold">${data?.stats.totalOpenInterest.toLocaleString() || '-'}</p>
        </Card>
        <Card className="p-4 japanese-card">
          <h3 className="text-sm text-muted-foreground mb-1">24h Trades</h3>
          <p className="text-2xl font-bold">{data?.stats.total24hTrades.toLocaleString() || '-'}</p>
        </Card>
      </div>

      {/* Markets Table */}
      <Card className="japanese-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-4 font-medium text-sm">Market</th>
                <th className="p-4 font-medium text-sm">Type</th>
                <th className="p-4 font-medium text-sm">Price</th>
                <th className="p-4 font-medium text-sm">24h Change</th>
                <th className="p-4 font-medium text-sm">24h Volume</th>
                <th className="p-4 font-medium text-sm">24h High/Low</th>
                <th className="p-4 font-medium text-sm">Open Interest</th>
                <th className="p-4 font-medium text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading markets...
                  </td>
                </tr>
              ) : filteredMarkets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No markets found
                  </td>
                </tr>
              ) : (
                filteredMarkets.map((market) => (
                  <tr key={market.symbol} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{market.symbol}</span>
                        {market.isNew && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={market.type === 'spot' ? 'default' : 'outline'}>
                        {market.type === 'spot' ? 'Spot' : 'Perp'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">${market.price.toFixed(2)}</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${
                        market.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">${market.volume24h.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-green-600">${market.high24h.toFixed(2)}</div>
                        <div className="text-red-600">${market.low24h.toFixed(2)}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono">
                        {market.openInterest ? `$${market.openInterest.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => router.push(`/trade/${market.symbol}`)}
                        className="px-3 py-1 text-sm japanese-button-primary rounded"
                      >
                        Trade
                      </button>
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