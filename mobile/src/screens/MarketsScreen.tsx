import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../config/constants';
import { TRADING_BOOKS } from '../config/contracts';
import { logInfo, logDebug } from '../utils/logger';

interface MarketStats {
  volume24h: string;
  high24h: string;
  low24h: string;
  lastPrice: string;
  change24h: number;
}

// Empty market data - will be populated from indexer later
const MARKET_DATA: Record<number, MarketStats | null> = {
  1: null, // WETH/USDC
  2: null, // WBTC/USDC
};

export function MarketsScreen() {
  const [selectedBook, setSelectedBook] = useState(TRADING_BOOKS[0]);
  const [refreshing, setRefreshing] = useState(false);
  
  const marketData = MARKET_DATA[selectedBook.id];
  
  const onRefresh = React.useCallback(() => {
    logDebug('MarketsScreen', 'Refreshing market data');
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
      logInfo('MarketsScreen', 'Market data refreshed');
    }, 1500);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Market Selector */}
        <View style={styles.marketSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TRADING_BOOKS.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.marketButton,
                  selectedBook.id === book.id && styles.marketButtonActive,
                ]}
                onPress={() => {
                  setSelectedBook(book);
                  logInfo('MarketsScreen', 'Selected market', { market: book.symbol });
                }}
              >
                <Text
                  style={[
                    styles.marketButtonText,
                    selectedBook.id === book.id && styles.marketButtonTextActive,
                  ]}
                >
                  {book.symbol}
                </Text>
                {MARKET_DATA[book.id] && (
                  <>
                    <Text style={styles.marketButtonPrice}>
                      ${MARKET_DATA[book.id]?.lastPrice}
                    </Text>
                    <Text style={[
                      styles.marketButtonChange,
                      { color: (MARKET_DATA[book.id]?.change24h || 0) >= 0 ? COLORS.success : COLORS.error }
                    ]}>
                      {(MARKET_DATA[book.id]?.change24h || 0) >= 0 ? '+' : ''}{MARKET_DATA[book.id]?.change24h}%
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Market Overview */}
        <View style={styles.marketOverview}>
          <Text style={styles.sectionTitle}>Market Overview</Text>
          
          {marketData ? (
            <>
              <View style={styles.priceContainer}>
                <Text style={styles.currentPrice}>${marketData.lastPrice}</Text>
                <View style={[
                  styles.changeBadge,
                  { backgroundColor: marketData.change24h >= 0 ? COLORS.success + '20' : COLORS.error + '20' }
                ]}>
                  <Text style={[
                    styles.changeText,
                    { color: marketData.change24h >= 0 ? COLORS.success : COLORS.error }
                  ]}>
                    {marketData.change24h >= 0 ? '↑' : '↓'} {Math.abs(marketData.change24h)}%
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>24h Volume</Text>
                  <Text style={styles.statValue}>{marketData.volume24h}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>24h High</Text>
                  <Text style={styles.statValue}>${marketData.high24h}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>24h Low</Text>
                  <Text style={styles.statValue}>${marketData.low24h}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Spread</Text>
                  <Text style={styles.statValue}>0.05%</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>Market data will be available once indexing is connected</Text>
              <Text style={styles.noDataSubtext}>Place your first trade to see real-time updates</Text>
            </View>
          )}
        </View>

        {/* Market Info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Market Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Base Asset</Text>
            <Text style={styles.infoValue}>{selectedBook.base}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Quote Asset</Text>
            <Text style={styles.infoValue}>{selectedBook.quote}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Min Order Size</Text>
            <Text style={styles.infoValue}>0.001 {selectedBook.base}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tick Size</Text>
            <Text style={styles.infoValue}>0.01 {selectedBook.quote}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trading Fee</Text>
            <Text style={styles.infoValue}>0.1%</Text>
          </View>
        </View>

        {/* Trading Notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>📊 Live Trading Coming Soon</Text>
          <Text style={styles.noticeText}>
            Real-time order book and market depth will be available in the next update.
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.actionButton, styles.buyButton]}>
            <Text style={styles.actionButtonText}>Buy {selectedBook.base}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.sellButton]}>
            <Text style={styles.actionButtonText}>Sell {selectedBook.base}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  marketSelector: {
    paddingVertical: 16,
  },
  marketButton: {
    marginLeft: 16,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    minWidth: 140,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  marketButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  marketButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  marketButtonTextActive: {
    color: COLORS.primary,
  },
  marketButtonPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  marketButtonChange: {
    fontSize: 12,
    fontWeight: '500',
  },
  marketOverview: {
    padding: 16,
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 12,
  },
  changeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  noticeCard: {
    backgroundColor: COLORS.primary + '10',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: COLORS.success,
  },
  sellButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
  noDataContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary + '80',
    textAlign: 'center',
  },
});