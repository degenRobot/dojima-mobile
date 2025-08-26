import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/PortoProvider';
import { COLORS } from '../config/constants';
import { BalanceList } from '../components/portfolio/BalanceList';
import { PositionList } from '../components/portfolio/PositionList';
import { OrderHistory } from '../components/portfolio/OrderHistory';

export function PortfolioScreen() {
  const { userAddress, delegationStatus } = usePorto();
  const [activeTab, setActiveTab] = useState<'balances' | 'positions' | 'history'>('balances');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Refresh portfolio data
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  // Portfolio summary data (mock for now)
  const portfolioSummary = {
    totalValue: '$12,345.67',
    dayChange: '+$234.56',
    dayChangePercent: '+1.95%',
    isPositive: true,
  };

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
        {/* Account Info */}
        <View style={styles.accountSection}>
          <Text style={styles.accountLabel}>Wallet Address</Text>
          <Text style={styles.accountAddress}>
            {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Not connected'}
          </Text>
          <View style={styles.delegationBadge}>
            <Text style={styles.delegationText}>
              {delegationStatus === 'deployed' ? '✅ Gasless Enabled' : 
               delegationStatus === 'pending' ? '⏳ Setting up...' : 
               '❌ Gasless Disabled'}
            </Text>
          </View>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
          <Text style={styles.summaryValue}>{portfolioSummary.totalValue}</Text>
          <View style={styles.changeContainer}>
            <Text style={[
              styles.changeValue,
              portfolioSummary.isPositive ? styles.changePositive : styles.changeNegative
            ]}>
              {portfolioSummary.dayChange}
            </Text>
            <Text style={[
              styles.changePercent,
              portfolioSummary.isPositive ? styles.changePositive : styles.changeNegative
            ]}>
              {portfolioSummary.dayChangePercent}
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
            onPress={() => setActiveTab('balances')}
          >
            <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
              Balances
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'positions' && styles.tabActive]}
            onPress={() => setActiveTab('positions')}
          >
            <Text style={[styles.tabText, activeTab === 'positions' && styles.tabTextActive]}>
              Positions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'balances' && <BalanceList />}
          {activeTab === 'positions' && <PositionList />}
          {activeTab === 'history' && <OrderHistory />}
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
  accountSection: {
    padding: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  accountLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  accountAddress: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  delegationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  delegationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeValue: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  changePercent: {
    fontSize: 14,
    fontWeight: '500',
  },
  changePositive: {
    color: COLORS.success,
  },
  changeNegative: {
    color: COLORS.error,
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