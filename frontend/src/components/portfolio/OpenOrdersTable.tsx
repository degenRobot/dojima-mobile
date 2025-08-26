'use client';

import { useOpenOrders } from '@/hooks/api/useOrderHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useLimitOrders } from '@/hooks/useLimitOrders';
import { toast } from '@/lib/toast-manager';

export function OpenOrdersTable() {
  // TODO: Re-enable market filtering once market entity is created in indexer
  // const marketAddress = contracts.EnhancedSpotBook.address;
  const { orders, loading, refetch } = useOpenOrders();
  const { cancelOrder } = useLimitOrders();

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId);
      toast.success(`Order #${orderId} cancelled`);
      refetch();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error('Failed to cancel order');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  if (!orders || orders.length === 0) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">No open orders</div>;
  }

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
            <th></th>
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
              <td className="text-right font-mono">{order.amount}</td>
              <td className="text-right font-mono">
                {order.filled}/{order.amount} ({((order.filled / order.amount) * 100).toFixed(0)}%)
              </td>
              <td>
                <Badge 
                  variant={order.status === 'open' ? 'secondary' : 'default'}
                  className="capitalize"
                >
                  {order.status}
                </Badge>
              </td>
              <td className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(order.timestamp).toLocaleString()}
              </td>
              <td>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancelOrder(order.orderId)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}