'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { PortfolioChart } from '@/components/portfolio/PortfolioChart';
import { PortfolioTabs } from '@/components/portfolio/PortfolioTabs';
import { Card } from '@/components/ui/card';
import { WalletSelector } from '@/components/WalletSelector';
import { useRealPortfolioData } from '@/hooks/useRealPortfolioData';
import { DepositWithdrawModal } from '@/components/trading/DepositWithdrawModal';

export default function PortfolioPage() {
  const { isConnected } = useAccount();
  const { data: portfolioData, loading } = useRealPortfolioData();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ tab: 'deposit' | 'withdraw' }>({ tab: 'deposit' });

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center japanese-card max-w-md">
            <h2 className="text-2xl font-bold mb-4 japanese-heading">Please Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to view your portfolio, balances, and trading history.
            </p>
            <div className="flex justify-center">
              <WalletSelector />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">

      {/* Portfolio Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card className="p-6 japanese-card">
            <h2 className="text-2xl font-bold mb-4 japanese-heading">Portfolio</h2>
            <PortfolioChart />
          </Card>
        </div>
        
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Total Value</h3>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <>
                <p className="text-3xl font-bold">
                  ${portfolioData?.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} USD
                </p>
                <p className={`text-sm ${portfolioData?.totalValueChange24h ? portfolioData.totalValueChange24h >= 0 ? 'text-green-600' : 'text-red-600' : 'text-gray-500'}`}>
                  {portfolioData?.totalValueChange24h ? 
                    `${portfolioData.totalValueChange24h >= 0 ? '+' : ''}${portfolioData.totalValueChange24h.toFixed(2)}% (24h)` : 
                    '0.00% (24h)'
                  }
                </p>
              </>
            )}
          </Card>
          
          <Card className="p-6 japanese-card">
            <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                className="w-full py-2 japanese-button-primary rounded"
                onClick={() => {
                  setModalConfig({ tab: 'deposit' });
                  setDepositModalOpen(true);
                }}
              >
                Deposit
              </button>
              <button 
                className="w-full py-2 japanese-button rounded"
                onClick={() => {
                  setModalConfig({ tab: 'withdraw' });
                  setDepositModalOpen(true);
                }}
              >
                Withdraw
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Data Tables Section */}
      <PortfolioTabs />
      
      {/* Deposit/Withdraw Modal */}
      <DepositWithdrawModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        defaultTab={modalConfig.tab}
      />
    </div>
  );
}