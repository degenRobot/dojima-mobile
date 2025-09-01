import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { useRecentTrades, isIndexerAvailable } from '../../hooks/useIndexer';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../../config/contracts';

interface RecentTradesProps {
  pair: { 
    id?: number;
    base: string; 
    quote: string; 
    symbol: string;
  };
}

interface Trade {
  id: string;
  price: string;
  amount: string;
  time: string;
  side: 'buy' | 'sell';
}

const generateMockTrades = (basePrice: number): Trade[] => {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `trade-${i}`,
    price: (basePrice + (Math.random() - 0.5) * 10).toFixed(2),
    amount: (Math.random() * 5).toFixed(4),
    time: new Date(Date.now() - i * 60000).toLocaleTimeString(),
    side: Math.random() > 0.5 ? 'buy' : 'sell',
  }));
};

export function RecentTrades({ pair }: RecentTradesProps) {
  const bookId = pair?.id?.toString() || '1';
  const useRealData = isIndexerAvailable();
  
  // Fetch real data from indexer
  const { data: indexerData, isLoading } = useRecentTrades(bookId, 20);
  
  // Process trades data
  const trades = useMemo(() => {
    if (useRealData && indexerData) {
      const data = indexerData as any;
      // Process real trades from indexer
      return (data.items || []).map((trade: any) => ({
        id: trade.id,
        price: formatUnits(BigInt(trade.price || '0'), CONTRACTS.USDC.decimals),
        amount: formatUnits(BigInt(trade.amount || '0'), 18),
        time: new Date((trade.timestamp || 0) * 1000).toLocaleTimeString(),
        // Simple heuristic: if buyer address is lower than seller, it's a buy, otherwise sell
        side: (trade.buyer?.toLowerCase() || '') < (trade.seller?.toLowerCase() || '') ? 'buy' : 'sell' as 'buy' | 'sell',
      }));
    }
    
    // Fallback to mock data
    const basePrice = pair?.base === 'WBTC' ? 65000 : pair?.base === 'WETH' ? 2500 : 1;
    return generateMockTrades(basePrice);
  }, [indexerData, pair, useRealData]);
  const renderTrade = ({ item }: { item: Trade }) => (
    <View style={styles.tradeRow}>
      <Text style={[
        styles.priceText,
        item.side === 'buy' ? styles.buyText : styles.sellText,
      ]}>
        {item.price}
      </Text>
      <Text style={styles.amountText}>{item.amount}</Text>
      <Text style={styles.timeText}>{item.time}</Text>
    </View>
  );

  if (isLoading && useRealData) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading trades...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Price ({pair?.quote || 'USD'})</Text>
        <Text style={styles.headerText}>Amount ({pair?.base || 'TOKEN'})</Text>
        <Text style={styles.headerText}>Time</Text>
      </View>
      <View style={styles.list}>
        {trades.map((item: Trade) => (
          <View key={item.id}>
            {renderTrade({ item })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  headerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  buyText: {
    color: COLORS.buyColor,
  },
  sellText: {
    color: COLORS.sellColor,
  },
  amountText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  timeText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});