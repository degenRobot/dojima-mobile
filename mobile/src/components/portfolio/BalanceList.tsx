import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { CONTRACTS } from '../../config/contracts';
import { publicClient, walletClient } from '../../config/viemClient';
import { useWalletStore } from '../../store/walletStore';
import { formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

interface TokenBalance {
  symbol: string;
  name: string;
  walletBalance: string;
  clobAvailable: string;
  clobLocked: string;
  totalValue: string;
  decimals: number;
  address: string;
}

export function BalanceList() {
  const { wallet } = useWalletStore();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const tokens = [
    { ...CONTRACTS.USDC, price: 1 },
    { ...CONTRACTS.WETH, price: 2000 },
    { ...CONTRACTS.WBTC, price: 40000 },
  ];

  const fetchBalances = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      const balanceData: TokenBalance[] = [];

      for (const token of tokens) {
        // Fetch wallet balance
        const walletBalance = await publicClient.readContract({
          address: token.address,
          abi: token.abi,
          functionName: 'balanceOf',
          args: [wallet.address],
        }) as bigint;

        // Fetch CLOB balances
        const [available, locked] = await publicClient.readContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'getBalance',
          args: [wallet.address, token.address],
        }) as [bigint, bigint];

        const walletBalanceFormatted = formatUnits(walletBalance, token.decimals);
        const availableFormatted = formatUnits(available, token.decimals);
        const lockedFormatted = formatUnits(locked, token.decimals);

        const totalBalance = 
          parseFloat(walletBalanceFormatted) + 
          parseFloat(availableFormatted) + 
          parseFloat(lockedFormatted);

        balanceData.push({
          symbol: token.symbol,
          name: token.name,
          walletBalance: walletBalanceFormatted,
          clobAvailable: availableFormatted,
          clobLocked: lockedFormatted,
          totalValue: `$${(totalBalance * token.price).toFixed(2)}`,
          decimals: token.decimals,
          address: token.address,
        });
      }

      setBalances(balanceData);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [wallet]);

  const handleDeposit = async () => {
    if (!wallet || !selectedToken) return;

    setProcessing(true);
    try {
      const amountBigInt = parseUnits(amount, selectedToken.decimals);

      const hash = await walletClient.writeContract({
        address: CONTRACTS.UnifiedCLOB.address,
        abi: CONTRACTS.UnifiedCLOB.abi,
        functionName: 'deposit',
        args: [selectedToken.address, amountBigInt],
        account: privateKeyToAccount(wallet.privateKey),
      });

      await publicClient.waitForTransactionReceipt({ hash });
      
      Alert.alert('Success', `Deposited ${amount} ${selectedToken.symbol} to CLOB`);
      setModalVisible(false);
      setAmount('');
      fetchBalances();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Deposit failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet || !selectedToken) return;

    setProcessing(true);
    try {
      const amountBigInt = parseUnits(amount, selectedToken.decimals);

      const hash = await walletClient.writeContract({
        address: CONTRACTS.UnifiedCLOB.address,
        abi: CONTRACTS.UnifiedCLOB.abi,
        functionName: 'withdraw',
        args: [selectedToken.address, amountBigInt],
        account: privateKeyToAccount(wallet.privateKey),
      });

      await publicClient.waitForTransactionReceipt({ hash });
      
      Alert.alert('Success', `Withdrew ${amount} ${selectedToken.symbol} from CLOB`);
      setModalVisible(false);
      setAmount('');
      fetchBalances();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Withdrawal failed');
    } finally {
      setProcessing(false);
    }
  };

  const openActionModal = (token: TokenBalance, action: 'deposit' | 'withdraw') => {
    setSelectedToken(token);
    setActionType(action);
    setModalVisible(true);
  };

  const renderToken = ({ item }: { item: TokenBalance }) => (
    <View style={styles.tokenCard}>
      <View style={styles.tokenHeader}>
        <View>
          <Text style={styles.tokenSymbol}>{item.symbol}</Text>
          <Text style={styles.tokenName}>{item.name}</Text>
        </View>
        <Text style={styles.totalValue}>{item.totalValue}</Text>
      </View>
      
      <View style={styles.balanceSection}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Wallet:</Text>
          <Text style={styles.balanceValue}>{parseFloat(item.walletBalance).toFixed(4)}</Text>
        </View>
        
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>CLOB Available:</Text>
          <Text style={styles.balanceValue}>{parseFloat(item.clobAvailable).toFixed(4)}</Text>
        </View>
        
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>CLOB Locked:</Text>
          <Text style={[styles.balanceValue, styles.lockedValue]}>
            {parseFloat(item.clobLocked).toFixed(4)}
          </Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.depositButton]}
          onPress={() => openActionModal(item, 'deposit')}
        >
          <Text style={styles.actionButtonText}>Deposit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.withdrawButton]}
          onPress={() => openActionModal(item, 'withdraw')}
        >
          <Text style={styles.actionButtonText}>Withdraw</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading balances...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={balances}
        renderItem={renderToken}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === 'deposit' ? 'Deposit' : 'Withdraw'} {selectedToken?.symbol}
            </Text>
            
            <Text style={styles.modalLabel}>Amount</Text>
            <TextInput
              style={styles.modalInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
            
            {actionType === 'deposit' && (
              <Text style={styles.modalHint}>
                Available: {selectedToken?.walletBalance}
              </Text>
            )}
            
            {actionType === 'withdraw' && (
              <Text style={styles.modalHint}>
                Available: {selectedToken?.clobAvailable}
              </Text>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setAmount('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={actionType === 'deposit' ? handleDeposit : handleWithdraw}
                disabled={processing || !amount}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  listContent: {
    padding: 16,
  },
  tokenCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  tokenName: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.success,
  },
  balanceSection: {
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  balanceValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  lockedValue: {
    color: COLORS.warning,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  depositButton: {
    backgroundColor: COLORS.primary,
  },
  withdrawButton: {
    backgroundColor: COLORS.backgroundTertiary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.backgroundTertiary,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});