import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { COLORS } from '../../config/constants';

interface RecentTradesProps {
  pair: { base: string; quote: string; symbol: string };
}

interface Trade {
  id: string;
  price: string;
  amount: string;
  time: string;
  side: 'buy' | 'sell';
}

const mockTrades: Trade[] = Array.from({ length: 20 }, (_, i) => ({
  id: `trade-${i}`,
  price: (2345.67 + (Math.random() - 0.5) * 10).toFixed(2),
  amount: (Math.random() * 5).toFixed(4),
  time: new Date(Date.now() - i * 60000).toLocaleTimeString(),
  side: Math.random() > 0.5 ? 'buy' : 'sell',
}));

export function RecentTrades({ pair }: RecentTradesProps) {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Price ({pair.quote})</Text>
        <Text style={styles.headerText}>Amount ({pair.base})</Text>
        <Text style={styles.headerText}>Time</Text>
      </View>
      <FlatList
        data={mockTrades}
        renderItem={renderTrade}
        keyExtractor={item => item.id}
        style={styles.list}
      />
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
});