import React, { useState, useEffect } from 'react';
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
import { useCLOBContract, HARDCODED_PRICES } from '../hooks/useCLOBContract';
import { publicClient } from '../config/viemClient';
import { CONTRACTS } from '../config/contracts';
import { MintableERC20ABI, UnifiedCLOBV2ABI } from '../config/abis';
import { formatUnits } from 'viem';
import { COLORS } from '../config/constants';

interface TokenBalance {
  symbol: 'USDC' | 'WETH' | 'WBTC';
  walletBalance: string;
  clobBalance: string;
  usdValue: number;
}

export function PortfolioScreen() {
  const { userAddress, delegationStatus } = usePorto();
  const { withdrawFromCLOB, loading } = useCLOBContract();
  const [activeTab, setActiveTab] = useState<'balances' | 'positions' | 'history'>('balances');
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawToken, setWithdrawToken] = useState<'USDC' | 'WETH' | 'WBTC'>('USDC');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const fetchBalances = async () => {
    if (!userAddress) return;
    
    setLoadingBalances(true);
    try {
      const tokens: ('USDC' | 'WETH' | 'WBTC')[] = ['USDC', 'WETH', 'WBTC'];
      const newBalances: TokenBalance[] = [];
      
      for (const symbol of tokens) {
        const token = CONTRACTS[symbol];
        
        // Fetch wallet balance
        const walletBalance = await publicClient.readContract({
          address: token.address,
          abi: MintableERC20ABI,
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
        
        // Fetch CLOB balance
        const clobBalance = await publicClient.readContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: UnifiedCLOBV2ABI,
          functionName: 'getBalance',
          args: [userAddress, token.address],
        }) as bigint;
        
        const walletBalanceFormatted = formatUnits(walletBalance, token.decimals);
        const clobBalanceFormatted = formatUnits(clobBalance, token.decimals);
        
        const totalBalance = parseFloat(walletBalanceFormatted) + parseFloat(clobBalanceFormatted);
        const usdValue = totalBalance * HARDCODED_PRICES[symbol];
        
        newBalances.push({
          symbol,
          walletBalance: walletBalanceFormatted,
          clobBalance: clobBalanceFormatted,
          usdValue,
        });
      }
      
      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [userAddress]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  }, [userAddress]);

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    const balance = balances.find(b => b.symbol === withdrawToken);
    if (balance && parseFloat(withdrawAmount) > parseFloat(balance.clobBalance)) {
      Alert.alert('Insufficient Balance', `You only have ${balance.clobBalance} ${withdrawToken} in CLOB`);
      return;
    }
    
    const result = await withdrawFromCLOB(withdrawToken, withdrawAmount);
    if (result.success) {
      Alert.alert('Success', `Withdrew ${withdrawAmount} ${withdrawToken} from CLOB`);
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      await fetchBalances();
    } else {
      Alert.alert('Error', result.error || 'Withdrawal failed');
    }
  };

  // Calculate total portfolio value
  const totalValue = balances.reduce((sum, b) => sum + b.usdValue, 0);
  
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
              <TouchableOpacity 
                style={styles.withdrawButton}
                onPress={() => setWithdrawModalVisible(true)}
              >
                <Text style={styles.withdrawButtonText}>💸 Withdraw from CLOB</Text>
              </TouchableOpacity>
              
              {loadingBalances ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : (
                balances.map((balance) => (
                  <View key={balance.symbol} style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                      <Text style={styles.tokenSymbol}>{balance.symbol}</Text>
                      <Text style={styles.usdValue}>${balance.usdValue.toFixed(2)}</Text>
                    </View>
                    
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>Wallet:</Text>
                      <Text style={styles.balanceValue}>{parseFloat(balance.walletBalance).toFixed(4)}</Text>
                    </View>
                    
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>CLOB:</Text>
                      <Text style={styles.balanceValue}>{parseFloat(balance.clobBalance).toFixed(4)}</Text>
                    </View>
                    
                    <View style={[styles.balanceRow, styles.totalRow]}>
                      <Text style={styles.balanceLabel}>Total:</Text>
                      <Text style={styles.balanceValue}>
                        {(parseFloat(balance.walletBalance) + parseFloat(balance.clobBalance)).toFixed(4)}
                      </Text>
                    </View>
                  </View>
                ))
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
                const balance = balances.find(b => b.symbol === token);
                return (
                  <TouchableOpacity
                    key={token}
                    style={[
                      styles.tokenButton,
                      withdrawToken === token && styles.tokenButtonActive
                    ]}
                    onPress={() => setWithdrawToken(token)}
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
                      {balance ? parseFloat(balance.clobBalance).toFixed(2) : '0'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={`Amount (${withdrawToken})`}
              placeholderTextColor={COLORS.textSecondary}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
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
  withdrawButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  withdrawButtonText: {
    color: COLORS.background,
    fontSize: 16,
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