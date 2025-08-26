'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { BalancesTable } from './BalancesTable';
import { OpenOrdersTable } from './OpenOrdersTable';
import { PositionsTable } from './PositionsTable';
import { HistoryTable } from './HistoryTable';

type TabType = 'balances' | 'orders' | 'positions' | 'history';

export function PortfolioTabs() {
  const [activeTab, setActiveTab] = useState<TabType>('balances');

  const tabs = [
    { id: 'balances' as TabType, label: 'Balances' },
    { id: 'orders' as TabType, label: 'Open Orders' },
    { id: 'positions' as TabType, label: 'Positions' },
    { id: 'history' as TabType, label: 'History' },
  ];

  return (
    <Card className="japanese-card">
      {/* Tab Navigation */}
      <div className="border-b">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-medium transition-colors relative ${
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
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'balances' && <BalancesTable />}
        {activeTab === 'orders' && <OpenOrdersTable />}
        {activeTab === 'positions' && <PositionsTable />}
        {activeTab === 'history' && <HistoryTable />}
      </div>
    </Card>
  );
}