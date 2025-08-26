'use client';

import { usePortfolioData } from '@/hooks/mock/usePortfolioData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function PositionsTable() {
  const { data, loading } = usePortfolioData();

  const handleClosePosition = () => {
    // TODO: Implement position closing
  };

  if (loading) {
    return <div className="text-center py-8">Loading positions...</div>;
  }

  if (!data?.positions || data.positions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        <p>No open positions</p>
        <p className="text-sm mt-2">Perpetual trading coming soon!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="japanese-table w-full">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Side</th>
            <th className="text-right">Size</th>
            <th className="text-right">Entry Price</th>
            <th className="text-right">Mark Price</th>
            <th className="text-right">P&L</th>
            <th className="text-right">P&L %</th>
            <th className="text-right">Margin</th>
            <th className="text-right">Leverage</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.positions.map((position) => (
            <tr key={position.id}>
              <td className="font-medium">{position.pair}</td>
              <td>
                <Badge 
                  variant={position.side === 'long' ? 'default' : 'destructive'}
                  className="capitalize"
                >
                  {position.side}
                </Badge>
              </td>
              <td className="text-right font-mono">{position.amount}</td>
              <td className="text-right font-mono">${position.entryPrice.toFixed(2)}</td>
              <td className="text-right font-mono">${position.markPrice.toFixed(2)}</td>
              <td className={`text-right font-mono ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
              </td>
              <td className={`text-right font-mono ${position.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
              </td>
              <td className="text-right font-mono">${position.margin.toFixed(2)}</td>
              <td className="text-right font-mono">{position.leverage}x</td>
              <td>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleClosePosition()}
                >
                  Close
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}