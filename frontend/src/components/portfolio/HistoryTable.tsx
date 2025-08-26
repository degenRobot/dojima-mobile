'use client';

import { useOrderHistory } from '@/hooks/api/useOrderHistory';
import { Badge } from '@/components/ui/badge';

export function HistoryTable() {
  // TODO: Re-enable market filtering once market entity is created in indexer
  // const marketAddress = contracts.EnhancedSpotBook.address;
  const { orders, loading } = useOrderHistory();

  if (loading) {
    return <div className="text-center py-8">Loading history...</div>;
  }

  if (!orders || orders.length === 0) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">No order history</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'text-green-600';
      case 'partial':
        return 'text-yellow-600';
      case 'cancelled':
        return 'text-red-600';
      case 'open':
        return 'text-blue-600';
      default:
        return '';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="japanese-table w-full">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Type</th>
            <th>Side</th>
            <th className="text-right">Price</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Filled</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="font-medium">{order.pair}</td>
              <td>
                <Badge variant="outline" className="capitalize">
                  {order.type}
                </Badge>
              </td>
              <td>
                <Badge 
                  variant={order.side === 'buy' ? 'default' : 'destructive'}
                  className="capitalize"
                >
                  {order.side}
                </Badge>
              </td>
              <td className="text-right font-mono">${order.price.toFixed(2)}</td>
              <td className="text-right font-mono">{order.amount.toFixed(4)}</td>
              <td className="text-right font-mono">
                {order.filled.toFixed(4)} ({((order.filled / order.amount) * 100).toFixed(0)}%)
              </td>
              <td>
                <span className={`font-medium capitalize ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </td>
              <td className="text-sm text-muted-foreground">
                {new Date(order.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}