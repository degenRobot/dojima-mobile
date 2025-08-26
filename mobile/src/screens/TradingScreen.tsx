import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/PortoProvider';
import { useWebSocket } from '../providers/WebSocketProvider';
import { OrderBook } from '../components/trading/OrderBook';
import { OrderForm } from '../components/trading/OrderForm';
import { RecentTrades } from '../components/trading/RecentTrades';
import { PairSelector } from '../components/trading/PairSelector';
import { COLORS } from '../config/constants';
import { TRADING_PAIRS } from '../config/contracts';

export function TradingScreen() {
  const { isConnected: portoConnected, delegationStatus } = usePorto();
  const { isConnected: wsConnected } = useWebSocket();
  const [selectedPair, setSelectedPair] = useState(TRADING_PAIRS[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Refresh data here
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  // Show warning if not connected
  if (!portoConnected || delegationStatus === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>⚠️ Connection Error</Text>
          <Text style={styles.warningSubtext}>
            Unable to connect to trading services. Please check your connection.
          </Text>
          <TouchableOpacity style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Pair Selector */}
      <View style={styles.pairSelectorContainer}>
        <PairSelector 
          selectedPair={selectedPair} 
          onSelectPair={setSelectedPair}
        />
      </View>

      {/* Connection Status */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, wsConnected ? styles.statusDotGreen : styles.statusDotRed]} />
          <Text style={styles.statusText}>WebSocket</Text>
        </View>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, portoConnected ? styles.statusDotGreen : styles.statusDotRed]} />
          <Text style={styles.statusText}>Porto</Text>
        </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
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
  statusDotRed: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.textMuted,
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
  warningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  warningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.warning,
    marginBottom: 12,
  },
  warningSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});