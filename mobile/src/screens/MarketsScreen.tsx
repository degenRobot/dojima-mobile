import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../config/constants';
import { TRADING_PAIRS } from '../config/contracts';

// Mock market data
const mockMarketData = [
  {
    id: '1',
    pair: 'WETH/USDC',
    price: '2,345.67',
    change24h: '+5.23%',
    volume24h: '1.2M',
    high24h: '2,456.78',
    low24h: '2,234.56',
    isPositive: true,
  },
  {
    id: '2',
    pair: 'RISE/USDC',
    price: '0.4567',
    change24h: '-2.45%',
    volume24h: '567K',
    high24h: '0.4789',
    low24h: '0.4234',
    isPositive: false,
  },
  {
    id: '3',
    pair: 'WETH/RISE',
    price: '5,134.23',
    change24h: '+7.89%',
    volume24h: '234K',
    high24h: '5,456.78',
    low24h: '4,890.12',
    isPositive: true,
  },
];

export function MarketsScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Refresh market data
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const handleSelectMarket = (pair: string) => {
    // Navigate to trading screen with selected pair
    navigation.navigate('Trading' as never, { pair } as never);
  };

  const renderMarketItem = ({ item }: { item: typeof mockMarketData[0] }) => (
    <TouchableOpacity 
      style={styles.marketCard}
      onPress={() => handleSelectMarket(item.pair)}
      activeOpacity={0.7}
    >
      <View style={styles.marketHeader}>
        <Text style={styles.pairName}>{item.pair}</Text>
        <Text style={[
          styles.changePercent,
          item.isPositive ? styles.changePositive : styles.changeNegative
        ]}>
          {item.change24h}
        </Text>
      </View>
      
      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Price</Text>
        <Text style={styles.priceValue}>${item.price}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h Volume</Text>
          <Text style={styles.statValue}>${item.volume24h}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h High</Text>
          <Text style={styles.statValue}>${item.high24h}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h Low</Text>
          <Text style={styles.statValue}>${item.low24h}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const filteredMarkets = mockMarketData.filter(market =>
    market.pair.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <View style={styles.headerStatItem}>
          <Text style={styles.headerStatLabel}>Total Volume (24h)</Text>
          <Text style={styles.headerStatValue}>$2.1M</Text>
        </View>
        <View style={styles.headerStatItem}>
          <Text style={styles.headerStatLabel}>Active Markets</Text>
          <Text style={styles.headerStatValue}>3</Text>
        </View>
      </View>

      {/* Market List */}
      <FlatList
        data={filteredMarkets}
        renderItem={renderMarketItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No markets available</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerStats: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  headerStatItem: {
    flex: 1,
  },
  headerStatLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  listContent: {
    padding: 16,
  },
  marketCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pairName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  changePercent: {
    fontSize: 16,
    fontWeight: '600',
  },
  changePositive: {
    color: COLORS.success,
  },
  changeNegative: {
    color: COLORS.error,
  },
  priceContainer: {
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
});