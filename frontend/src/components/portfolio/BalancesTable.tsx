'use client';

import { useState } from 'react';
import { useRealPortfolioData } from '@/hooks/useRealPortfolioData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { DepositWithdrawModal } from '@/components/trading/DepositWithdrawModal';

export function BalancesTable() {
  const { data, loading } = useRealPortfolioData();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ tab: 'deposit' | 'withdraw', token?: 'WETH' | 'USDC' }>({ tab: 'deposit' });

  if (loading) {
    return <div className="text-center py-8">Loading balances...</div>;
  }

  if (!data?.balances || data.balances.length === 0) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">No balances found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="japanese-table w-full">
        <thead>
          <tr>
            <th>Token</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Price</th>
            <th className="text-right">Value</th>
            <th className="text-right">24h Change</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.balances.map((balance) => (
            <tr key={balance.token}>
              <td className="font-medium">{balance.symbol}</td>
              <td className="text-right font-mono">{balance.amount}</td>
              <td className="text-right font-mono">${balance.price.toFixed(2)}</td>
              <td className="text-right font-mono">${balance.value.toFixed(2)}</td>
              <td className="text-right">
                <Badge 
                  variant={balance.change24h >= 0 ? 'default' : 'destructive'}
                  className="font-mono"
                >
                  {balance.change24h >= 0 ? '+' : ''}{balance.change24h.toFixed(2)}%
                </Badge>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setModalConfig({ tab: 'deposit', token: balance.symbol as 'WETH' | 'USDC' });
                      setDepositModalOpen(true);
                    }}
                    title="Deposit"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setModalConfig({ tab: 'withdraw', token: balance.symbol as 'WETH' | 'USDC' });
                      setDepositModalOpen(true);
                    }}
                    title="Withdraw"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={3}>Total</td>
            <td className="text-right font-mono">${data.totalValue.toFixed(2)}</td>
            <td className="text-right">
              <Badge 
                variant={data.totalValueChange24h >= 0 ? 'default' : 'destructive'}
                className="font-mono"
              >
                {data.totalValueChange24h >= 0 ? '+' : ''}{data.totalValueChange24hPercent.toFixed(2)}%
              </Badge>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      
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