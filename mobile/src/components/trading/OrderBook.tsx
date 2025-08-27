import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { COLORS, UI_CONFIG } from '../../config/constants';
import { logDebug, logError } from '../../utils/logger';

interface OrderBookProps {
  pair: {
    id?: number;
    base: string;
    quote: string;
    symbol: string;
  };
}

interface OrderLevel {
  price: string;
  amount: string;
  total: string;
  percentage: number;
}

// Mock order book data generator with better error handling
const generateMockOrders = (basePrice: number, type: 'bid' | 'ask'): OrderLevel[] => {
  try {
    return Array.from({ length: 10 }, (_, i) => {
      const priceOffset = type === 'bid' ? -i * 0.5 : (i + 1) * 0.5;
      const price = (basePrice + priceOffset).toFixed(2);
      const amount = (Math.random() * 10).toFixed(4);
      const total = (parseFloat(price) * parseFloat(amount)).toFixed(2);
      const percentage = Math.random() * 100;
      
      return { price, amount, total, percentage };
    });
  } catch (error) {
    logError('OrderBook', 'Failed to generate mock orders', { error, type });
    return [];
  }
};

export function OrderBook({ pair }: OrderBookProps) {
  // Use mock data with proper error handling
  const basePrice = pair?.base === 'WBTC' ? 65000 : pair?.base === 'WETH' ? 2500 : 1;
  
  const [bids, setBids] = useState<OrderLevel[]>(() => generateMockOrders(basePrice, 'bid'));
  const [asks, setAsks] = useState<OrderLevel[]>(() => generateMockOrders(basePrice, 'ask'));
  const [spread, setSpread] = useState('0.00');
  const [spreadPercent, setSpreadPercent] = useState('0.00%');

  // Log component mount
  useEffect(() => {
    logDebug('OrderBook', 'Component mounted', { 
      pair: pair?.symbol || 'unknown',
      hasBids: bids.length > 0,
      hasAsks: asks.length > 0 
    });
  }, []);

  // Calculate spread with error handling
  useEffect(() => {
    try {
      if (asks.length > 0 && bids.length > 0) {
        const bestAsk = parseFloat(asks[0].price);
        const bestBid = parseFloat(bids[0].price);
        
        if (!isNaN(bestAsk) && !isNaN(bestBid) && bestBid > 0) {
          const spreadValue = bestAsk - bestBid;
          const spreadPct = ((spreadValue / bestBid) * 100).toFixed(2);
          setSpread(spreadValue.toFixed(2));
          setSpreadPercent(`${spreadPct}%`);
        }
      }
    } catch (error) {
      logError('OrderBook', 'Failed to calculate spread', { error });
    }
  }, [asks, bids]);

  // Simulate order book updates
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        // Randomly update a few orders to simulate market activity
        setBids(prev => {
          const updated = [...prev];
          const indexToUpdate = Math.floor(Math.random() * Math.min(5, updated.length));
          if (updated[indexToUpdate]) {
            updated[indexToUpdate] = {
              ...updated[indexToUpdate],
              amount: (Math.random() * 10).toFixed(4),
              total: (Math.random() * 20000).toFixed(2),
              percentage: Math.random() * 100,
            };
          }
          return updated;
        });

        setAsks(prev => {
          const updated = [...prev];
          const indexToUpdate = Math.floor(Math.random() * Math.min(5, updated.length));
          if (updated[indexToUpdate]) {
            updated[indexToUpdate] = {
              ...updated[indexToUpdate],
              amount: (Math.random() * 10).toFixed(4),
              total: (Math.random() * 20000).toFixed(2),
              percentage: Math.random() * 100,
            };
          }
          return updated;
        });
      } catch (error) {
        logError('OrderBook', 'Failed to update order book', { error });
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const renderOrderLevel = (item: OrderLevel | null, type: 'bid' | 'ask') => {
    if (!item) return null;
    
    return (
      <TouchableOpacity style={styles.orderRow} activeOpacity={0.7}>
        <View style={[
          styles.depthBar,
          type === 'bid' ? styles.bidDepthBar : styles.askDepthBar,
          { width: `${Math.min(item.percentage || 0, 100)}%` },
        ]} />
        <Text style={[
          styles.priceText,
          type === 'bid' ? styles.bidText : styles.askText,
        ]}>
          {item.price || '0.00'}
        </Text>
        <Text style={styles.amountText}>{item.amount || '0.00'}</Text>
        <Text style={styles.totalText}>{item.total || '0.00'}</Text>
      </TouchableOpacity>
    );
  };

  // Error handling for missing pair
  if (!pair) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No trading pair selected</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Price ({pair.quote || 'USD'})</Text>
        <Text style={styles.headerText}>Amount ({pair.base || 'TOKEN'})</Text>
        <Text style={styles.headerText}>Total</Text>
      </View>

      {/* Asks (Sell Orders) */}
      <FlatList
        data={asks.slice(0, UI_CONFIG.orderBookLevels).reverse()}
        renderItem={({ item }) => renderOrderLevel(item, 'ask')}
        keyExtractor={(item, index) => `ask-${index}`}
        scrollEnabled={false}
        style={styles.asksList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sell orders</Text>
          </View>
        }
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No buy orders</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
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
    color: COLORS.text,
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
    borderColor: COLORS.border,
  },
  spreadLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  spreadValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});