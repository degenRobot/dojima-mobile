'use client';

import { useState, useMemo } from 'react';
import { useOpenOrders, useOrderHistory } from '@/hooks/api/useOrderHistory';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';
import { useLimitOrders } from '@/hooks/useLimitOrders';
import { useCLOBEventNotifications } from '@/hooks/useCLOBEventNotifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Minus } from 'lucide-react';
import { useAccount } from 'wagmi';
import { DepositWithdrawModal } from './DepositWithdrawModal';
import { formatDistanceToNow } from 'date-fns';

type TabType = 'balances' | 'orders' | 'positions' | 'trades';

export function UserOrdersPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('balances');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ tab: 'deposit' | 'withdraw', token?: 'WETH' | 'USDC' }>({ tab: 'deposit' });
  const [isUpdating, setIsUpdating] = useState(false);
  // TODO: Re-enable market filtering once market entity is created in indexer
  const { orders: openOrders, refetch: refetchOpenOrders } = useOpenOrders();
  const { orders: orderHistory, refetch: refetchOrderHistory } = useOrderHistory();
  // Filter for completed orders only (filled or cancelled)
  const completedOrders = orderHistory.filter(order => 
    order.status === 'filled' || order.status === 'cancelled' || order.status === 'partial'
  );
  const { baseBalance, quoteBalance } = useSimpleCLOB();
  const { cancelOrder } = useLimitOrders();
  const { address } = useAccount();
  
  // Track user's order hashes for event notifications
  const userOrderHashes = useMemo(() => {
    const hashes = new Set<string>();
    openOrders.forEach(order => {
      if (order.orderId) {
        hashes.add(order.orderId);
      }
    });
    return hashes;
  }, [openOrders]);
  
  // Handle order events - refetch when orders are matched or cancelled
  const handleOrderMatched = async (orderHash: string) => {
    console.log('Order matched:', orderHash);
    setIsUpdating(true);
    // Refetch open orders and order history
    await Promise.all([
      refetchOpenOrders(),
      refetchOrderHistory()
    ]);
    setIsUpdating(false);
  };
  
  const handleOrderCancelled = async (orderHash: string) => {
    console.log('Order cancelled:', orderHash);
    setIsUpdating(true);
    // Refetch open orders
    await refetchOpenOrders();
    setIsUpdating(false);
  };
  
  // Use CLOB event notifications
  useCLOBEventNotifications(userOrderHashes, handleOrderMatched, handleOrderCancelled);
  

  const tabs = [
    { id: 'balances' as TabType, label: 'Balances' },
    { id: 'orders' as TabType, label: 'Open Orders' },
    { id: 'positions' as TabType, label: 'Positions' },
    { id: 'trades' as TabType, label: 'Trade History' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-primary dark:text-primary'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {!address ? (
          <div className="text-center py-4 text-gray-600 dark:text-gray-400">Connect wallet to view your data</div>
        ) : (
          <>
            {/* Balances Tab */}
            {activeTab === 'balances' && (
              <div className="space-y-2">
                {[
                    { token: 'WETH', balance: baseBalance },
                    { token: 'USDC', balance: quoteBalance }
                  ].map(({ token, balance }) => (
                    <div key={token} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {token.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium">{token}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-mono">{balance}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setModalConfig({ tab: 'deposit', token: token as 'WETH' | 'USDC' });
                              setDepositModalOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setModalConfig({ tab: 'withdraw', token: token as 'WETH' | 'USDC' });
                              setDepositModalOpen(true);
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Open Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-2">
                {isUpdating && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    Updating orders...
                  </div>
                )}
                {openOrders.length === 0 ? (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">No open orders</div>
                ) : (
                  openOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-3">
                        <Badge variant={order.side === 'buy' ? 'default' : 'destructive'}>
                          {order.side.toUpperCase()}
                        </Badge>
                        <div>
                          <div className="font-medium">{order.pair}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {order.type} @ ${order.price}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono text-sm">{order.amount}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Filled: {order.filled}/{order.amount}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={async () => {
                            try {
                              await cancelOrder(order.orderId);
                              refetchOpenOrders();
                            } catch {
                              // Failed to cancel order
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Positions Tab */}
            {activeTab === 'positions' && (
              <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                No open positions
              </div>
            )}

            {/* Trade History Tab */}
            {activeTab === 'trades' && (
              <div className="space-y-2">
                {completedOrders.length === 0 ? (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">No trade history</div>
                ) : (
                  completedOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-3">
                        <Badge variant={order.side === 'buy' ? 'default' : 'destructive'}>
                          {order.side.toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{order.pair}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDistanceToNow(new Date(order.timestamp), { addSuffix: true })}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {order.amount.toFixed(4)} @ ${order.price.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Total: ${(order.amount * order.price).toFixed(2)}
                          {order.filled > 0 && order.filled < order.amount && 
                            ` (Filled: ${((order.filled / order.amount) * 100).toFixed(0)}%)`
                          }
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Deposit/Withdraw Modal */}
      <DepositWithdrawModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        defaultTab={modalConfig.tab}
        defaultToken={modalConfig.token}
      />
    </div>
  );
}