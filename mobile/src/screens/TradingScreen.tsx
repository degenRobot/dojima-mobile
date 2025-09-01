import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/SimplePortoProvider';
import { useWebSocket } from '../providers/MockWebSocketProvider';
import { OrderBook } from '../components/trading/OrderBook';
import { OrderForm } from '../components/trading/OrderForm';
import { RecentTrades } from '../components/trading/RecentTrades';
import { PairSelector } from '../components/trading/PairSelector';
import { COLORS } from '../config/constants';
import { TRADING_BOOKS } from '../config/contracts';
import { logDebug, logInfo } from '../utils/logger';
import type { TradingPair } from '../types/trading';

export function TradingScreen() {
  const { isInitialized, delegationStatus, isConnected: portoConnected } = usePorto();
  const { isConnected: wsConnected } = useWebSocket();
  const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_BOOKS[0] as TradingPair);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');
  
  // Log state on mount
  useEffect(() => {
    logInfo('TradingScreen', 'Component mounted', {
      isInitialized,
      delegationStatus,
      portoConnected,
      wsConnected
    });
  }, []);
  
  useEffect(() => {
    logDebug('TradingScreen', 'State changed', {
      isInitialized,
      delegationStatus,
      portoConnected,
      wsConnected
    });
  }, [isInitialized, delegationStatus, portoConnected, wsConnected]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Refresh data here
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Pair Selector */}
      <View style={styles.pairSelectorContainer}>
        <PairSelector 
          selectedPair={selectedPair} 
          onSelectPair={setSelectedPair}
        />
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {delegationStatus === 'ready' ? '✅ Ready to Trade' : '⏳ Setting up...'}
        </Text>
        {wsConnected && (
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, styles.statusDotGreen]} />
            <Text style={styles.statusLabel}>Live</Text>
          </View>
        )}
      </View>

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
        {/* Order Form */}
        <View style={styles.orderFormContainer}>
          <OrderForm pair={selectedPair} />
        </View>

        {/* Market Data Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'book' && styles.tabActive]}
            onPress={() => setActiveTab('book')}
          >
            <Text style={[styles.tabText, activeTab === 'book' && styles.tabTextActive]}>
              Order Book
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'trades' && styles.tabActive]}
            onPress={() => setActiveTab('trades')}
          >
            <Text style={[styles.tabText, activeTab === 'trades' && styles.tabTextActive]}>
              Recent Trades
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'book' ? (
            <OrderBook pair={selectedPair} />
          ) : (
            <RecentTrades pair={selectedPair} />
          )}
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
  pairSelectorContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotGreen: {
    backgroundColor: COLORS.success,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  orderFormContainer: {
    margin: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabContent: {
    flex: 1,
    minHeight: 400,
  },
});