import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../config/constants';
import { CONTRACTS } from '../config/contracts';
import { useCLOBContract, HARDCODED_PRICES } from '../hooks/useCLOBContract';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePorto } from '../providers/SimplePortoProvider';
import { logInfo, logError } from '../utils/logger';

interface QuickSwapModalProps {
  visible: boolean;
  onClose: () => void;
  defaultFromToken?: 'WETH' | 'WBTC' | 'USDC';
  defaultToToken?: 'WETH' | 'WBTC' | 'USDC';
  defaultAction?: 'buy' | 'sell';
}

interface Token {
  symbol: string;
  decimals: number;
  price: number;
}

const TOKENS: Token[] = [
  { symbol: 'WETH', decimals: 18, price: HARDCODED_PRICES.WETH },
  { symbol: 'WBTC', decimals: 8, price: HARDCODED_PRICES.WBTC },
  { symbol: 'USDC', decimals: 6, price: HARDCODED_PRICES.USDC },
];

export function QuickSwapModal({ 
  visible, 
  onClose, 
  defaultFromToken,
  defaultToToken,
  defaultAction = 'buy'
}: QuickSwapModalProps) {
  const { isInitialized, delegationStatus } = usePorto();
  const { placeMarketOrder, loading: contractLoading } = useCLOBContract();
  const { portfolio, refreshPortfolio, hasBalance } = usePortfolio();
  
  // Set up default tokens based on action
  const getDefaultTokens = () => {
    if (defaultAction === 'buy' && defaultFromToken) {
      // Buying the specified token
      if (defaultFromToken === 'USDC') {
        // If buying USDC, we need to sell another token for USDC
        return {
          from: TOKENS.find(t => t.symbol === 'WETH')!, // Default to selling WETH
          to: TOKENS.find(t => t.symbol === 'USDC')!
        };
      } else {
        // Buying WETH or WBTC with USDC
        return {
          from: TOKENS.find(t => t.symbol === 'USDC')!,
          to: TOKENS.find(t => t.symbol === defaultFromToken)!
        };
      }
    } else if (defaultAction === 'sell' && defaultFromToken) {
      // Selling the specified token
      if (defaultFromToken === 'USDC') {
        // If selling USDC, we're buying another token with USDC
        return {
          from: TOKENS.find(t => t.symbol === 'USDC')!,
          to: TOKENS.find(t => t.symbol === 'WETH')! // Default to buying WETH
        };
      } else {
        // Selling WETH or WBTC for USDC
        return {
          from: TOKENS.find(t => t.symbol === defaultFromToken)!,
          to: TOKENS.find(t => t.symbol === 'USDC')!
        };
      }
    } else {
      // Default: USDC -> WETH
      return {
        from: TOKENS.find(t => t.symbol === (defaultFromToken || 'USDC'))!,
        to: TOKENS.find(t => t.symbol === (defaultToToken || 'WETH'))!
      };
    }
  };
  
  const defaults = getDefaultTokens();
  const [fromToken, setFromToken] = useState<Token>(defaults.from);
  const [toToken, setToToken] = useState<Token>(defaults.to);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [loading, setLoading] = useState(false);
  
  // Calculate estimated output
  const estimatedOutput = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return '0';
    
    const fromValue = parseFloat(amount) * fromToken.price;
    const toAmount = fromValue / toToken.price;
    
    return toAmount.toFixed(6);
  }, [amount, fromToken, toToken]);
  
  // Get available balance
  const availableBalance = useMemo(() => {
    const tokenInfo = portfolio?.tokens.find(t => t.symbol === fromToken.symbol);
    return tokenInfo?.clobBalance || '0';
  }, [portfolio, fromToken]);
  
  // Find the appropriate trading book
  const getTradingBook = () => {
    if ((fromToken.symbol === 'WETH' && toToken.symbol === 'USDC') ||
        (fromToken.symbol === 'USDC' && toToken.symbol === 'WETH')) {
      return { bookId: 1, isBuy: fromToken.symbol === 'USDC' };
    }
    if ((fromToken.symbol === 'WBTC' && toToken.symbol === 'USDC') ||
        (fromToken.symbol === 'USDC' && toToken.symbol === 'WBTC')) {
      return { bookId: 2, isBuy: fromToken.symbol === 'USDC' };
    }
    return null;
  };
  
  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    const book = getTradingBook();
    if (!book) {
      Alert.alert('Invalid Pair', 'This trading pair is not supported');
      return;
    }
    
    if (!hasBalance(fromToken.symbol, amount, 'clob')) {
      Alert.alert('Insufficient Balance', `You don't have enough ${fromToken.symbol} in your CLOB account`);
      return;
    }
    
    try {
      setLoading(true);
      logInfo('QuickSwapModal', 'Executing swap', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: amount,
        bookId: book.bookId,
        isBuy: book.isBuy,
      });
      
      let orderAmount = amount;
      if (book.isBuy) {
        orderAmount = estimatedOutput;
      }
      
      const result = await placeMarketOrder(
        book.bookId,
        book.isBuy,
        orderAmount,
        parseFloat(slippage) * 100
      );
      
      if (result.success) {
        Alert.alert(
          'Swap Successful!',
          `Swapped ${amount} ${fromToken.symbol} for ~${estimatedOutput} ${toToken.symbol}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setAmount('');
                refreshPortfolio();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Swap Failed', result.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      logError('QuickSwapModal', 'Swap failed', error);
      Alert.alert('Error', error.message || 'Failed to execute swap');
    } finally {
      setLoading(false);
    }
  };
  
  const setMaxAmount = () => {
    setAmount(availableBalance);
  };
  
  const isReady = isInitialized && delegationStatus === 'ready';
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Quick Swap</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* From Section */}
          <View style={styles.section}>
            <Text style={styles.label}>From</Text>
            <View style={styles.tokenRow}>
              <TouchableOpacity 
                style={styles.tokenSelector}
                onPress={() => {
                  // Cycle through available tokens for 'from'
                  const availableTokens = TOKENS.filter(t => t.symbol !== toToken.symbol);
                  const currentIndex = availableTokens.findIndex(t => t.symbol === fromToken.symbol);
                  const nextIndex = (currentIndex + 1) % availableTokens.length;
                  setFromToken(availableTokens[nextIndex]);
                }}
              >
                <Text style={styles.tokenSymbol}>{fromToken.symbol}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceText}>
                Available: {availableBalance} {fromToken.symbol}
              </Text>
              <TouchableOpacity onPress={setMaxAmount}>
                <Text style={styles.maxButton}>MAX</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Arrow */}
          <TouchableOpacity 
            style={styles.arrowContainer}
            onPress={() => {
              // Swap tokens
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
            }}
          >
            <Text style={styles.arrow}>⇅</Text>
          </TouchableOpacity>
          
          {/* To Section */}
          <View style={styles.section}>
            <Text style={styles.label}>To (estimated)</Text>
            <View style={styles.tokenRow}>
              <TouchableOpacity 
                style={styles.tokenSelector}
                onPress={() => {
                  // Cycle through available tokens for 'to'
                  const availableTokens = TOKENS.filter(t => t.symbol !== fromToken.symbol);
                  const currentIndex = availableTokens.findIndex(t => t.symbol === toToken.symbol);
                  const nextIndex = (currentIndex + 1) % availableTokens.length;
                  setToToken(availableTokens[nextIndex]);
                }}
              >
                <Text style={styles.tokenSymbol}>{toToken.symbol}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              <Text style={styles.outputAmount}>{estimatedOutput}</Text>
            </View>
          </View>
          
          {/* Slippage */}
          <View style={styles.slippageSection}>
            <Text style={styles.slippageLabel}>Max Slippage</Text>
            <View style={styles.slippageButtons}>
              {['0.5', '1', '2'].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.slippageButton,
                    slippage === value && styles.slippageButtonActive,
                  ]}
                  onPress={() => setSlippage(value)}
                >
                  <Text
                    style={[
                      styles.slippageText,
                      slippage === value && styles.slippageTextActive,
                    ]}
                  >
                    {value}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Swap Button */}
          <TouchableOpacity
            style={[
              styles.swapButton,
              (!isReady || loading || contractLoading) && styles.swapButtonDisabled,
            ]}
            onPress={handleSwap}
            disabled={!isReady || loading || contractLoading}
          >
            {(loading || contractLoading) ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.swapButtonText}>
                Swap {fromToken.symbol} for {toToken.symbol}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    color: COLORS.textMuted,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  dropdownArrow: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  outputAmount: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  balanceText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  maxButton: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  arrow: {
    fontSize: 20,
    color: COLORS.textMuted,
  },
  slippageSection: {
    marginBottom: 20,
  },
  slippageLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  slippageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  slippageButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 6,
    alignItems: 'center',
  },
  slippageButtonActive: {
    backgroundColor: COLORS.primary + '20',
  },
  slippageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  slippageTextActive: {
    color: COLORS.primary,
  },
  swapButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  swapButtonDisabled: {
    opacity: 0.5,
  },
  swapButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});