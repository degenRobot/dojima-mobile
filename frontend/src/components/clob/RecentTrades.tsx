'use client';

import { useSimpleCLOBEvents } from '@/hooks/useSimpleCLOBEvents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

export function RecentTrades() {
  const { recentTrades } = useSimpleCLOBEvents();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No trades yet
            </p>
          ) : (
            recentTrades.map((trade, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {trade.isBuyOrder ? (
                    <ArrowUpIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowDownIcon className="w-4 h-4 text-red-500" />
                  )}
                  <span className="font-mono text-sm">{trade.amount} WETH</span>
                </div>
                
                <Badge variant="outline" className="font-mono">
                  ${trade.price}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}