import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/SimplePortoProvider';
import { useWebSocket } from '../providers/MockWebSocketProvider';
import { useCLOBContract } from '../hooks/useCLOBContract';
import { OrderBook } from '../components/trading/OrderBook';
import { OrderForm } from '../components/trading/OrderForm';
import { RecentTrades } from '../components/trading/RecentTrades';
import { PairSelector } from '../components/trading/PairSelector';
import { COLORS } from '../config/constants';
import { TRADING_BOOKS } from '../config/contracts';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';

export function TradingScreen() {
  const { isInitialized, delegationStatus, isConnected: portoConnected } = usePorto();
  const { isConnected: wsConnected } = useWebSocket();
  const { depositToCLOB, withdrawFromCLOB, loading } = useCLOBContract();
  const [selectedPair, setSelectedPair] = useState(TRADING_BOOKS[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'WETH' | 'WBTC'>('USDC');
  const [amount, setAmount] = useState('');
  
  // Log state on mount and changes
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

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      logWarn('TradingScreen', 'Invalid deposit amount', { amount });
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    logInfo('TradingScreen', 'Starting deposit', { token: selectedToken, amount });
    const result = await depositToCLOB(selectedToken, amount);
    
    if (result.success) {
      logInfo('TradingScreen', 'Deposit successful', { token: selectedToken, amount, bundleId: result.bundleId });
      Alert.alert('Success', `Deposited ${amount} ${selectedToken} to CLOB`);
      setDepositModalVisible(false);
      setAmount('');
    } else {
      logError('TradingScreen', 'Deposit failed', { error: result.error });
      Alert.alert('Error', result.error || 'Deposit failed');
    }
  };
  
  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      logWarn('TradingScreen', 'Invalid withdraw amount', { amount });
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    logInfo('TradingScreen', 'Starting withdrawal', { token: selectedToken, amount });
    const result = await withdrawFromCLOB(selectedToken, amount);
    
    if (result.success) {
      logInfo('TradingScreen', 'Withdrawal successful', { token: selectedToken, amount, bundleId: result.bundleId });
      Alert.alert('Success', `Withdrew ${amount} ${selectedToken} from CLOB`);
      setWithdrawModalVisible(false);
      setAmount('');
    } else {
      logError('TradingScreen', 'Withdrawal failed', { error: result.error });
      Alert.alert('Error', result.error || 'Withdrawal failed');
    }
  };

  // Since we only show this screen after setup, we can assume delegation is ready
  // Just log the current state for debugging
  logDebug('TradingScreen', 'Trading screen active', {
    isInitialized,
    delegationStatus,
    portoConnected,
    wsConnected,
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Pair Selector */}
      <View style={styles.pairSelectorContainer}>
        <PairSelector 
          selectedPair={selectedPair} 
          onSelectPair={setSelectedPair}
        />
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.depositButton]}
            onPress={() => setDepositModalVisible(true)}
          >
            <Text style={styles.actionButtonText}>⬇️ Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={() => setWithdrawModalVisible(true)}
          >
            <Text style={styles.actionButtonText}>⬆️ Withdraw</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.statusInfo}>
          {delegationStatus === 'ready' ? '✅ Ready' : '⏳ Setting up...'}
        </Text>
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
      
      {/* Deposit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={depositModalVisible}
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Deposit to CLOB</Text>
            
            <View style={styles.tokenSelector}>
              {(['USDC', 'WETH', 'WBTC'] as const).map(token => (
                <TouchableOpacity
                  key={token}
                  style={[
                    styles.tokenButton,
                    selectedToken === token && styles.tokenButtonActive
                  ]}
                  onPress={() => setSelectedToken(token)}
                >
                  <Text style={[
                    styles.tokenButtonText,
                    selectedToken === token && styles.tokenButtonTextActive
                  ]}>
                    {token}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={`Amount (${selectedToken})`}
              placeholderTextColor={COLORS.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDepositModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleDeposit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.confirmButtonText}>Deposit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Withdraw Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={withdrawModalVisible}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw from CLOB</Text>
            
            <View style={styles.tokenSelector}>
              {(['USDC', 'WETH', 'WBTC'] as const).map(token => (
                <TouchableOpacity
                  key={token}
                  style={[
                    styles.tokenButton,
                    selectedToken === token && styles.tokenButtonActive
                  ]}
                  onPress={() => setSelectedToken(token)}
                >
                  <Text style={[
                    styles.tokenButtonText,
                    selectedToken === token && styles.tokenButtonTextActive
                  ]}>
                    {token}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={`Amount (${selectedToken})`}
              placeholderTextColor={COLORS.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setWithdrawModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleWithdraw}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.confirmButtonText}>Withdraw</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  depositButton: {
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
  },
  withdrawButton: {
    backgroundColor: COLORS.warning + '20',
    borderColor: COLORS.warning,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statusInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  tokenSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  tokenButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tokenButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tokenButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tokenButtonTextActive: {
    color: COLORS.background,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
});