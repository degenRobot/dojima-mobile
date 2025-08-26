import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { COLORS, ORDER_STATUS } from '../../config/constants';

interface Order {
  id: string;
  pair: string;
  type: 'limit' | 'market';
  side: 'buy' | 'sell';
  price: string;
  amount: string;
  filled: string;
  status: string;
  time: string;
}

const mockOrders: Order[] = [
  {
    id: '1',
    pair: 'WETH/USDC',
    type: 'limit',
    side: 'buy',
    price: '$2,340.00',
    amount: '1.5',
    filled: '1.5',
    status: 'filled',
    time: '2h ago',
  },
  {
    id: '2',
    pair: 'RISE/USDC',
    type: 'market',
    side: 'sell',
    price: '$0.4567',
    amount: '5,000',
    filled: '5,000',
    status: 'filled',
    time: '4h ago',
  },
  {
    id: '3',
    pair: 'WETH/USDC',
    type: 'limit',
    side: 'buy',
    price: '$2,320.00',
    amount: '2.0',
    filled: '0',
    status: 'open',
    time: '6h ago',
  },
  {
    id: '4',
    pair: 'WETH/RISE',
    type: 'limit',
    side: 'sell',
    price: '$5,200.00',
    amount: '0.5',
    filled: '0',
    status: 'cancelled',
    time: '1d ago',
  },
];

export function OrderHistory() {
  const [filter, setFilter] = useState<'all' | 'open' | 'filled' | 'cancelled'>('all');

  const filteredOrders = mockOrders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return COLORS.success;
      case 'open':
        return COLORS.primary;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
      <View style={styles.orderHeader}>
        <Text style={styles.pair}>{item.pair}</Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      
      <View style={styles.orderDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>
            {item.type === 'limit' ? 'Limit' : 'Market'} {item.side === 'buy' ? 'Buy' : 'Sell'}
          </Text>
          <Text style={[
            styles.detailValue,
            { color: item.side === 'buy' ? COLORS.buyColor : COLORS.sellColor },
          ]}>
            {item.amount}
          </Text>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>{item.price}</Text>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Filled</Text>
          <Text style={styles.detailValue}>{item.filled}/{item.amount}</Text>
        </View>
      </View>
      
      <Text style={styles.time}>{item.time}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'open', 'filled', 'cancelled'] as const).map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filter === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(status)}
          >
            <Text style={[
              styles.filterText,
              filter === status && styles.filterTextActive,
            ]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  filterButton: {
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundTertiary,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.textPrimary,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pair: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
});