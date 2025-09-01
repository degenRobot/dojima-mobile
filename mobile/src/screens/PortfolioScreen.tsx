import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/SimplePortoProvider';
import { useCLOBContract } from '../hooks/useCLOBContract';
import { usePortfolio } from '../hooks/usePortfolio';
import { COLORS } from '../config/constants';

export function PortfolioScreen() {
  const { userAddress, delegationStatus } = usePorto();
  const { depositToCLOB, withdrawFromCLOB, loading } = useCLOBContract();
  const { 
    portfolio, 
    loading: loadingPortfolio, 
    refreshing: portfolioRefreshing, 
    handleRefresh,
    error,
    getTokenInfo,
    hasBalance 
  } = usePortfolio();
  
  const [activeTab, setActiveTab] = useState<'balances' | 'positions' | 'history'>('balances');
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositToken, setDepositToken] = useState<'USDC' | 'WETH' | 'WBTC'>('USDC');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSelectedPercentage, setDepositSelectedPercentage] = useState<number | null>(null);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawToken, setWithdrawToken] = useState<'USDC' | 'WETH' | 'WBTC'>('USDC');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSelectedPercentage, setWithdrawSelectedPercentage] = useState<number | null>(null);

  // Use portfolio hook data
  const totalValue = portfolio?.totalValueUSD || 0;
  const loadingBalances = loadingPortfolio;
  const refreshing = portfolioRefreshing;

  const onRefresh = React.useCallback(async () => {
    await handleRefresh();
  }, [handleRefresh]);

  // Handle deposit percentage selection
  const handleDepositPercentageClick = (percentage: number) => {
    setDepositSelectedPercentage(percentage);
    const tokenInfo = getTokenInfo(depositToken);
    const walletBalance = parseFloat(tokenInfo?.walletBalance || '0');
    const newAmount = (walletBalance * percentage / 100).toFixed(6);
    setDepositAmount(newAmount);
  };

  // Handle withdraw percentage selection
  const handleWithdrawPercentageClick = (percentage: number) => {
    setWithdrawSelectedPercentage(percentage);
    const tokenInfo = getTokenInfo(withdrawToken);
    const clobBalance = parseFloat(tokenInfo?.clobBalance || '0');
    const newAmount = (clobBalance * percentage / 100).toFixed(6);
    setWithdrawAmount(newAmount);
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    const tokenInfo = getTokenInfo(depositToken);
    const availableBalance = tokenInfo?.walletBalance || '0';
    
    if (parseFloat(depositAmount) > parseFloat(availableBalance)) {
      Alert.alert('Insufficient Balance', `You only have ${availableBalance} ${depositToken} available in wallet`);
      return;
    }
    
    const result = await depositToCLOB(depositToken, depositAmount);
    if (result.success) {
      Alert.alert('Success', `Deposited ${depositAmount} ${depositToken} to CLOB`);
      setDepositModalVisible(false);
      setDepositAmount('');
      setDepositSelectedPercentage(null);
      await handleRefresh();
    } else {
      Alert.alert('Error', result.error || 'Deposit failed');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    const tokenInfo = getTokenInfo(withdrawToken);
    const availableBalance = tokenInfo?.clobBalance || '0';
    
    if (parseFloat(withdrawAmount) > parseFloat(availableBalance)) {
      Alert.alert('Insufficient Balance', `You only have ${availableBalance} ${withdrawToken} available in CLOB`);
      return;
    }
    
    const result = await withdrawFromCLOB(withdrawToken, withdrawAmount);
    if (result.success) {
      Alert.alert('Success', `Withdrew ${withdrawAmount} ${withdrawToken} from CLOB`);
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawSelectedPercentage(null);
      await handleRefresh();
    } else {
      Alert.alert('Error', result.error || 'Withdrawal failed');
    }
  };
  
  // Mock day change for MVP
  const dayChange = totalValue * 0.0195;
  const dayChangePercent = 1.95;
  const isPositive = dayChange > 0;

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
              {delegationStatus === 'ready' ? '✅ Gasless Enabled' : 
               delegationStatus === 'pending' ? '⏳ Setting up...' : 
               '❌ Gasless Disabled'}
            </Text>
          </View>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
          <Text style={styles.summaryValue}>${totalValue.toFixed(2)}</Text>
          <View style={styles.changeContainer}>
            <Text style={[
              styles.changeValue,
              isPositive ? styles.changePositive : styles.changeNegative
            ]}>
              {isPositive ? '+' : '-'}${Math.abs(dayChange).toFixed(2)}
            </Text>
            <Text style={[
              styles.changePercent,
              isPositive ? styles.changePositive : styles.changeNegative
            ]}>
              {isPositive ? '+' : '-'}{Math.abs(dayChangePercent).toFixed(2)}%
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
          {activeTab === 'balances' && (
            <View style={styles.balancesContainer}>
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.depositButton]}
                  onPress={() => setDepositModalVisible(true)}
                >
                  <Text style={styles.actionButtonText}>💰 Deposit to CLOB</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.withdrawButton]}
                  onPress={() => setWithdrawModalVisible(true)}
                >
                  <Text style={styles.actionButtonText}>💸 Withdraw from CLOB</Text>
                </TouchableOpacity>
              </View>
              
              {loadingBalances ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>⚠️ Failed to load balances</Text>
                  <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                ['USDC', 'WETH', 'WBTC'].map((symbol) => {
                  const tokenInfo = getTokenInfo(symbol);
                  if (!tokenInfo) return null;
                  
                  return (
                    <View key={symbol} style={styles.balanceCard}>
                      <View style={styles.balanceHeader}>
                        <Text style={styles.tokenSymbol}>{symbol}</Text>
                        <Text style={styles.usdValue}>${tokenInfo.totalValue.toFixed(2)}</Text>
                      </View>
                      
                      <View style={styles.balanceRow}>
                        <Text style={styles.balanceLabel}>Wallet:</Text>
                        <Text style={styles.balanceValue}>{parseFloat(tokenInfo.walletBalance).toFixed(4)}</Text>
                      </View>
                      
                      <View style={styles.balanceRow}>
                        <Text style={styles.balanceLabel}>CLOB Available:</Text>
                        <Text style={styles.balanceValue}>{parseFloat(tokenInfo.clobBalance).toFixed(4)}</Text>
                      </View>
                      
                      {parseFloat(tokenInfo.clobLocked) > 0 && (
                        <View style={styles.balanceRow}>
                          <Text style={styles.balanceLabel}>CLOB Locked:</Text>
                          <Text style={[styles.balanceValue, styles.lockedValue]}>
                            {parseFloat(tokenInfo.clobLocked).toFixed(4)}
                          </Text>
                        </View>
                      )}
                      
                      <View style={[styles.balanceRow, styles.totalRow]}>
                        <Text style={styles.balanceLabel}>Total:</Text>
                        <Text style={styles.balanceValue}>
                          {(parseFloat(tokenInfo.walletBalance) + parseFloat(tokenInfo.clobBalance) + parseFloat(tokenInfo.clobLocked)).toFixed(4)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
          
          {activeTab === 'positions' && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>📊 No open positions</Text>
              <Text style={styles.emptySubtext}>Start trading to see your positions here</Text>
            </View>
          )}
          
          {activeTab === 'history' && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>📜 No trading history</Text>
              <Text style={styles.emptySubtext}>Your completed trades will appear here</Text>
            </View>
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
              {(['USDC', 'WETH', 'WBTC'] as const).map(token => {
                const tokenInfo = getTokenInfo(token);
                const availableBalance = tokenInfo?.walletBalance || '0';
                return (
                  <TouchableOpacity
                    key={token}
                    style={[
                      styles.tokenButton,
                      depositToken === token && styles.tokenButtonActive
                    ]}
                    onPress={() => {
                      setDepositToken(token);
                      setDepositAmount('');
                      setDepositSelectedPercentage(null);
                    }}
                  >
                    <Text style={[
                      styles.tokenButtonText,
                      depositToken === token && styles.tokenButtonTextActive
                    ]}>
                      {token}
                    </Text>
                    <Text style={[
                      styles.tokenBalance,
                      depositToken === token && styles.tokenBalanceActive
                    ]}>
                      {parseFloat(availableBalance).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Percentage Selector for Deposit */}
            <View style={styles.percentageSelector}>
              {[25, 50, 75, 100].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    styles.percentageButton,
                    depositSelectedPercentage === pct && styles.percentageButtonActive
                  ]}
                  onPress={() => handleDepositPercentageClick(pct)}
                >
                  <Text style={[
                    styles.percentageButtonText,
                    depositSelectedPercentage === pct && styles.percentageButtonTextActive
                  ]}>
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={`Amount (${depositToken})`}
              placeholderTextColor={COLORS.textSecondary}
              value={depositAmount}
              onChangeText={(text) => {
                setDepositAmount(text);
                setDepositSelectedPercentage(null);
              }}
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
              {(['USDC', 'WETH', 'WBTC'] as const).map(token => {
                const tokenInfo = getTokenInfo(token);
                const availableBalance = tokenInfo?.clobBalance || '0';
                return (
                  <TouchableOpacity
                    key={token}
                    style={[
                      styles.tokenButton,
                      withdrawToken === token && styles.tokenButtonActive
                    ]}
                    onPress={() => {
                      setWithdrawToken(token);
                      setWithdrawAmount('');
                      setWithdrawSelectedPercentage(null);
                    }}
                  >
                    <Text style={[
                      styles.tokenButtonText,
                      withdrawToken === token && styles.tokenButtonTextActive
                    ]}>
                      {token}
                    </Text>
                    <Text style={[
                      styles.tokenBalance,
                      withdrawToken === token && styles.tokenBalanceActive
                    ]}>
                      {parseFloat(availableBalance).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Percentage Selector for Withdraw */}
            <View style={styles.percentageSelector}>
              {[25, 50, 75, 100].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    styles.percentageButton,
                    withdrawSelectedPercentage === pct && styles.percentageButtonActive
                  ]}
                  onPress={() => handleWithdrawPercentageClick(pct)}
                >
                  <Text style={[
                    styles.percentageButtonText,
                    withdrawSelectedPercentage === pct && styles.percentageButtonTextActive
                  ]}>
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={`Amount (${withdrawToken})`}
              placeholderTextColor={COLORS.textSecondary}
              value={withdrawAmount}
              onChangeText={(text) => {
                setWithdrawAmount(text);
                setWithdrawSelectedPercentage(null);
              }}
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
  accountSection: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  accountLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  accountAddress: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  delegationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
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
    borderBottomColor: COLORS.border,
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
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabContent: {
    flex: 1,
    minHeight: 400,
  },
  balancesContainer: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  depositButton: {
    backgroundColor: COLORS.success,
  },
  withdrawButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  usdValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    marginTop: 6,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  tokenBalance: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tokenBalanceActive: {
    color: COLORS.background,
  },
  percentageSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  percentageButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  percentageButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  percentageButtonTextActive: {
    color: COLORS.primary,
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
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginBottom: 12,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  lockedValue: {
    color: COLORS.warning || COLORS.textSecondary,
    fontStyle: 'italic',
  },
});