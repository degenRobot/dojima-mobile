import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWalletStore } from '../store/walletStore';
import { CONTRACTS } from '../config/contracts';
import { COLORS } from '../config/constants';
import { publicClient } from '../config/viemClient';
import { formatUnits, parseUnits } from 'viem';
import { useOrderPlacement } from '../hooks/useOrderPlacement';
import { formatAmountForContract, formatPriceForContract, calculateQuoteAmount } from '../utils/contractDecimals';

interface TradingBook {
  id: number;
  name: string;
  baseToken: string;
  quoteToken: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
}

const TRADING_BOOKS: TradingBook[] = [
  {
    id: 1,
    name: 'WETH/USDC',
    baseToken: CONTRACTS.WETH.address,
    quoteToken: CONTRACTS.USDC.address,
    baseSymbol: 'WETH',
    quoteSymbol: 'USDC',
    baseDecimals: 18,
    quoteDecimals: 6,
  },
  {
    id: 2,
    name: 'WBTC/USDC',
    baseToken: CONTRACTS.WBTC.address,
    quoteToken: CONTRACTS.USDC.address,
    baseSymbol: 'WBTC',
    quoteSymbol: 'USDC',
    baseDecimals: 8,
    quoteDecimals: 6,
  },
];

export function SwapScreen() {
  const { wallet } = useWalletStore();
  const [selectedBook, setSelectedBook] = useState<TradingBook>(TRADING_BOOKS[0]);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState<{
    baseAvailable: bigint;
    baseLocked: bigint;
    quoteAvailable: bigint;
    quoteLocked: bigint;
  }>({
    baseAvailable: 0n,
    baseLocked: 0n,
    quoteAvailable: 0n,
    quoteLocked: 0n,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { placeOrder, isPlacing } = useOrderPlacement();

  // Calculate quote amount
  const quoteAmount = useMemo(() => {
    if (!price || !amount) return '0';
    try {
      const priceNum = parseFloat(price);
      const amountNum = parseFloat(amount);
      return (priceNum * amountNum).toFixed(selectedBook.quoteDecimals);
    } catch {
      return '0';
    }
  }, [price, amount, selectedBook]);

  // Fetch balances
  const fetchBalances = async () => {
    if (!wallet) return;

    setRefreshing(true);
    try {
      const [baseBalance, quoteBalance] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'getBalance',
          args: [wallet.address, selectedBook.baseToken],
        }) as Promise<[bigint, bigint]>,
        publicClient.readContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'getBalance',
          args: [wallet.address, selectedBook.quoteToken],
        }) as Promise<[bigint, bigint]>,
      ]);

      setBalances({
        baseAvailable: baseBalance[0],
        baseLocked: baseBalance[1],
        quoteAvailable: quoteBalance[0],
        quoteLocked: quoteBalance[1],
      });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [wallet, selectedBook]);

  // Validate order
  const validateOrder = (): string | null => {
    if (!price || parseFloat(price) <= 0) {
      return 'Please enter a valid price';
    }
    if (!amount || parseFloat(amount) <= 0) {
      return 'Please enter a valid amount';
    }

    const amountInWei = parseUnits(amount, selectedBook.baseDecimals);
    const quoteAmountInWei = parseUnits(quoteAmount, selectedBook.quoteDecimals);

    if (orderType === 'buy') {
      if (quoteAmountInWei > balances.quoteAvailable) {
        return `Insufficient ${selectedBook.quoteSymbol} balance`;
      }
    } else {
      if (amountInWei > balances.baseAvailable) {
        return `Insufficient ${selectedBook.baseSymbol} balance`;
      }
    }

    return null;
  };

  // Handle order submission
  const handlePlaceOrder = async () => {
    const error = validateOrder();
    if (error) {
      Alert.alert('Invalid Order', error);
      return;
    }

    try {
      setLoading(true);
      
      const orderId = await placeOrder({
        bookId: selectedBook.id,
        isBuy: orderType === 'buy',
        price: price,
        amount: amount,
        baseDecimals: selectedBook.baseDecimals,
        quoteDecimals: selectedBook.quoteDecimals,
      });

      if (orderId) {
        Alert.alert(
          'Order Placed!',
          `Your ${orderType} order #${orderId} has been placed successfully.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear form
                setPrice('');
                setAmount('');
                fetchBalances();
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Order Failed', error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trading Pair Selector */}
          <View style={styles.pairSelector}>
            <Text style={styles.sectionTitle}>Trading Pair</Text>
            <View style={styles.pairButtons}>
              {TRADING_BOOKS.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={[
                    styles.pairButton,
                    selectedBook.id === book.id && styles.pairButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedBook(book);
                    setPrice('');
                    setAmount('');
                  }}
                >
                  <Text
                    style={[
                      styles.pairButtonText,
                      selectedBook.id === book.id && styles.pairButtonTextActive,
                    ]}
                  >
                    {book.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Order Type Selector */}
          <View style={styles.orderTypeSection}>
            <View style={styles.orderTypeButtons}>
              <TouchableOpacity
                style={[
                  styles.orderTypeButton,
                  orderType === 'buy' && styles.buyButton,
                ]}
                onPress={() => setOrderType('buy')}
              >
                <Text
                  style={[
                    styles.orderTypeText,
                    orderType === 'buy' && styles.orderTypeTextActive,
                  ]}
                >
                  Buy {selectedBook.baseSymbol}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.orderTypeButton,
                  orderType === 'sell' && styles.sellButton,
                ]}
                onPress={() => setOrderType('sell')}
              >
                <Text
                  style={[
                    styles.orderTypeText,
                    orderType === 'sell' && styles.orderTypeTextActive,
                  ]}
                >
                  Sell {selectedBook.baseSymbol}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Display */}
          <View style={styles.balanceSection}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>
                {selectedBook.baseSymbol} Available:
              </Text>
              <Text style={styles.balanceValue}>
                {formatUnits(balances.baseAvailable, selectedBook.baseDecimals)}
              </Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>
                {selectedBook.quoteSymbol} Available:
              </Text>
              <Text style={styles.balanceValue}>
                {formatUnits(balances.quoteAvailable, selectedBook.quoteDecimals)}
              </Text>
            </View>
          </View>

          {/* Order Form */}
          <View style={styles.orderForm}>
            {/* Price Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Price ({selectedBook.quoteSymbol})
              </Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Amount ({selectedBook.baseSymbol})
              </Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.maxButton}
                onPress={() => {
                  const maxAmount =
                    orderType === 'sell'
                      ? formatUnits(balances.baseAvailable, selectedBook.baseDecimals)
                      : price
                      ? (
                          parseFloat(formatUnits(balances.quoteAvailable, selectedBook.quoteDecimals)) /
                          parseFloat(price)
                        ).toString()
                      : '0';
                  setAmount(maxAmount);
                }}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </View>

            {/* Total Display */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>
                {quoteAmount} {selectedBook.quoteSymbol}
              </Text>
            </View>

            {/* Place Order Button */}
            <TouchableOpacity
              style={[
                styles.placeOrderButton,
                orderType === 'buy' ? styles.buyOrderButton : styles.sellOrderButton,
                (loading || isPlacing || !wallet) && styles.disabledButton,
              ]}
              onPress={handlePlaceOrder}
              disabled={loading || isPlacing || !wallet}
            >
              {loading || isPlacing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.placeOrderText}>
                  {orderType === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
                </Text>
              )}
            </TouchableOpacity>

            {!wallet && (
              <Text style={styles.warningText}>
                Please connect your wallet to trade
              </Text>
            )}
          </View>

          {/* Order Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Order Information</Text>
            <Text style={styles.infoText}>
              • Orders are placed without automatic matching
            </Text>
            <Text style={styles.infoText}>
              • Anyone can call matchOrders to execute crossing orders
            </Text>
            <Text style={styles.infoText}>
              • Maker fee: 0.1% | Taker fee: 0.2%
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  pairSelector: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  pairButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pairButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pairButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundTertiary,
  },
  pairButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pairButtonTextActive: {
    color: COLORS.primary,
  },
  orderTypeSection: {
    marginBottom: 20,
  },
  orderTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  orderTypeButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: COLORS.success + '20',
  },
  sellButton: {
    backgroundColor: COLORS.error + '20',
  },
  orderTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  orderTypeTextActive: {
    color: COLORS.textPrimary,
  },
  balanceSection: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  orderForm: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  maxButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundTertiary,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  placeOrderButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyOrderButton: {
    backgroundColor: COLORS.success,
  },
  sellOrderButton: {
    backgroundColor: COLORS.error,
  },
  disabledButton: {
    opacity: 0.5,
  },
  placeOrderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  warningText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    color: COLORS.warning,
  },
  infoSection: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
});