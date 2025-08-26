'use client';

import { useEffect, useState } from 'react';
import { useRealPortfolioData } from '@/hooks/useRealPortfolioData';

export function PortfolioChart() {
  const { data, loading } = useRealPortfolioData();
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);

  useEffect(() => {
    // TODO: Replace with real historical data from indexer
    // Generate mock historical data for the chart
    const mockHistoricalData = [];
    const currentValue = data?.totalValue || 0;
    const days = 30;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Add some random variation
      const variation = (Math.random() - 0.5) * 0.1; // ±10% variation
      const value = currentValue * (1 - (i / days) * 0.2) * (1 + variation);
      
      mockHistoricalData.push({
        time: date.toLocaleDateString(),
        value: Math.max(0, value),
      });
    }
    
    setChartData(mockHistoricalData);
  }, [data]);

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">Loading portfolio data...</p>
      </div>
    );
  }

  // Simple line chart visualization (placeholder)
  // TODO: Integrate a proper charting library like recharts or chart.js
  const maxValue = Math.max(...chartData.map(d => d.value));
  const minValue = Math.min(...chartData.map(d => d.value));
  const range = maxValue - minValue;

  return (
    <div className="h-[300px] relative">
      <div className="absolute inset-0 flex items-end">
        {chartData.map((point, index) => {
          const height = ((point.value - minValue) / range) * 100;
          return (
            <div
              key={index}
              className="flex-1 bg-gradient-to-t from-blue-500/20 to-blue-500/40 mx-px hover:from-blue-500/30 hover:to-blue-500/50 transition-colors"
              style={{ height: `${height}%` }}
              title={`${point.time}: $${point.value.toFixed(2)}`}
            />
          );
        })}
      </div>
      
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground">
        <span>${maxValue.toFixed(0)}</span>
        <span>${((maxValue + minValue) / 2).toFixed(0)}</span>
        <span>${minValue.toFixed(0)}</span>
      </div>
      
      {/* Current value */}
      {data && (
        <div className="absolute top-4 right-4 text-right">
          <p className="text-2xl font-bold">${data.totalValue.toFixed(2)}</p>
          <p className={`text-sm ${data.totalValueChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.totalValueChange24h >= 0 ? '+' : ''}{data.totalValueChange24h.toFixed(2)} ({data.totalValueChange24hPercent.toFixed(2)}%)
          </p>
        </div>
      )}
    </div>
  );
}