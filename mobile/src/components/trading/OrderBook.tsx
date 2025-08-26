import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useWebSocket } from '../../providers/WebSocketProvider';
import { COLORS, UI_CONFIG } from '../../config/constants';
import { CONTRACTS } from '../../config/contracts';

interface OrderBookProps {
  pair: { base: string; quote: string; symbol: string };
}

interface OrderLevel {
  price: string;
  amount: string;
  total: string;
  percentage: number;
}

// Mock order book data
const mockBids: OrderLevel[] = Array.from({ length: 10 }, (_, i) => ({
  price: (2345.67 - i * 0.5).toFixed(2),
  amount: (Math.random() * 10).toFixed(4),
  total: (Math.random() * 20000).toFixed(2),
  percentage: Math.random() * 100,
}));

const mockAsks: OrderLevel[] = Array.from({ length: 10 }, (_, i) => ({
  price: (2345.67 + (i + 1) * 0.5).toFixed(2),
  amount: (Math.random() * 10).toFixed(4),
  total: (Math.random() * 20000).toFixed(2),
  percentage: Math.random() * 100,
}));

export function OrderBook({ pair }: OrderBookProps) {
  const { getLatestEvents } = useWebSocket();
  const [bids, setBids] = useState<OrderLevel[]>(mockBids);
  const [asks, setAsks] = useState<OrderLevel[]>(mockAsks);
  const [spread, setSpread] = useState('0.50');
  const [spreadPercent, setSpreadPercent] = useState('0.02%');

  // Subscribe to order book events
  useEffect(() => {
    // Get latest order book events from WebSocket
    const events = getLatestEvents(CONTRACTS.EnhancedSpotBook.address, 'OrderPlaced');
    
    // Process events and update order book
    // This is simplified - actual implementation would aggregate orders
    if (events.length > 0) {
      console.log('Order book events:', events);
    }

    // Calculate spread
    if (asks.length > 0 && bids.length > 0) {
      const bestAsk = parseFloat(asks[0].price);
      const bestBid = parseFloat(bids[0].price);
      const spreadValue = bestAsk - bestBid;
      const spreadPct = ((spreadValue / bestBid) * 100).toFixed(2);
      setSpread(spreadValue.toFixed(2));
      setSpreadPercent(`${spreadPct}%`);
    }
  }, [getLatestEvents, asks, bids]);

  const renderOrderLevel = (item: OrderLevel, type: 'bid' | 'ask') => (
    <TouchableOpacity style={styles.orderRow} activeOpacity={0.7}>
      <View style={[
        styles.depthBar,
        type === 'bid' ? styles.bidDepthBar : styles.askDepthBar,
        { width: `${item.percentage}%` },
      ]} />
      <Text style={[
        styles.priceText,
        type === 'bid' ? styles.bidText : styles.askText,
      ]}>
        {item.price}
      </Text>
      <Text style={styles.amountText}>{item.amount}</Text>
      <Text style={styles.totalText}>{item.total}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Price ({pair.quote})</Text>
        <Text style={styles.headerText}>Amount ({pair.base})</Text>
        <Text style={styles.headerText}>Total</Text>
      </View>

      {/* Asks (Sell Orders) */}
      <FlatList
        data={asks.slice(0, UI_CONFIG.orderBookLevels).reverse()}
        renderItem={({ item }) => renderOrderLevel(item, 'ask')}
        keyExtractor={(item, index) => `ask-${index}`}
        scrollEnabled={false}
        style={styles.asksList}
      />

      {/* Spread */}
      <View style={styles.spreadContainer}>
        <Text style={styles.spreadLabel}>Spread</Text>
        <Text style={styles.spreadValue}>{spread} ({spreadPercent})</Text>
      </View>

      {/* Bids (Buy Orders) */}
      <FlatList
        data={bids.slice(0, UI_CONFIG.orderBookLevels)}
        renderItem={({ item }) => renderOrderLevel(item, 'bid')}
        keyExtractor={(item, index) => `bid-${index}`}
        scrollEnabled={false}
        style={styles.bidsList}
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
  asksList: {
    maxHeight: 200,
  },
  bidsList: {
    maxHeight: 200,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    position: 'relative',
  },
  depthBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    opacity: 0.15,
  },
  bidDepthBar: {
    backgroundColor: COLORS.buyColor,
  },
  askDepthBar: {
    backgroundColor: COLORS.sellColor,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  bidText: {
    color: COLORS.buyColor,
  },
  askText: {
    color: COLORS.sellColor,
  },
  amountText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  totalText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  spreadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  spreadLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  spreadValue: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});