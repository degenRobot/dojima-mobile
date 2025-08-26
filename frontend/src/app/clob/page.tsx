'use client';

import { TradingPanel } from '@/components/clob/TradingPanel';
import { RecentTrades } from '@/components/clob/RecentTrades';
import { TokenFaucet } from '@/components/clob/TokenFaucet';
import { useAccount } from 'wagmi';

export default function CLOBPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold mb-4">Simple CLOB</h1>
          <p className="text-muted-foreground">
            Please connect your wallet to start trading
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Simple CLOB</h1>
        <p className="text-muted-foreground">
          Trade WETH/USDC with market orders at a fixed price
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main trading panel */}
        <div className="lg:col-span-2">
          <TradingPanel />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <TokenFaucet />
          <RecentTrades />
        </div>
      </div>
    </div>
  );
}