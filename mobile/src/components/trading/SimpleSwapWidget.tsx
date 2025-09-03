import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { CONTRACTS, TRADING_BOOKS } from '../../config/contracts';
import { useCLOBContract, HARDCODED_PRICES } from '../../hooks/useCLOBContract';
import { usePortfolio } from '../../hooks/usePortfolio';
import { usePorto } from '../../providers/SimplePortoProvider';
import { formatUnits, parseUnits } from 'viem';
import { logInfo, logError } from '../../utils/logger';

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

export function SimpleSwapWidget() {
  const { isInitialized, delegationStatus } = usePorto();
  const { placeMarketOrder, loading: contractLoading } = useCLOBContract();
  const { portfolio, refreshPortfolio, hasBalance } = usePortfolio();
  
  const [fromToken, setFromToken] = useState<Token>(TOKENS[2]); // USDC
  const [toToken, setToToken] = useState<Token>(TOKENS[0]); // WETH
  const [fromAmount, setFromAmount] = useState('');
  const [slippage, setSlippage] = useState('1'); // 1% default
  const [loading, setLoading] = useState(false);
  
  // Calculate estimated output
  const estimatedOutput = useMemo(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return '0';
    
    const fromValue = parseFloat(fromAmount) * fromToken.price;
    const toAmount = fromValue / toToken.price;
    
    return toAmount.toFixed(6);
  }, [fromAmount, fromToken, toToken]);
  
  // Get available balance
  const availableBalance = useMemo(() => {
    const tokenInfo = portfolio?.tokens.find(t => t.symbol === fromToken.symbol);
    return tokenInfo?.clobBalance || '0';
  }, [portfolio, fromToken]);
  
  // Find the appropriate trading book
  const getTradingBook = () => {
    // WETH/USDC
    if ((fromToken.symbol === 'WETH' && toToken.symbol === 'USDC') ||
        (fromToken.symbol === 'USDC' && toToken.symbol === 'WETH')) {
      return { bookId: 1, isBuy: fromToken.symbol === 'USDC' };
    }
    // WBTC/USDC
    if ((fromToken.symbol === 'WBTC' && toToken.symbol === 'USDC') ||
        (fromToken.symbol === 'USDC' && toToken.symbol === 'WBTC')) {
      return { bookId: 2, isBuy: fromToken.symbol === 'USDC' };
    }
    return null;
  };
  
  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    const book = getTradingBook();
    if (!book) {
      Alert.alert('Invalid Pair', 'This trading pair is not supported');
      return;
    }
    
    if (!hasBalance(fromToken.symbol, fromAmount, 'clob')) {
      Alert.alert('Insufficient Balance', `You don't have enough ${fromToken.symbol} in your CLOB account`);
      return;
    }
    
    try {
      setLoading(true);
      logInfo('SimpleSwapWidget', 'Executing swap', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount,
        bookId: book.bookId,
        isBuy: book.isBuy,
      });
      
      // For market orders, we need to specify the amount of base token
      // If buying (USDC -> WETH/WBTC), the amount is what we want to receive
      // If selling (WETH/WBTC -> USDC), the amount is what we're selling
      let orderAmount = fromAmount;
      if (book.isBuy) {
        // When buying with USDC, use the estimated output as the amount
        orderAmount = estimatedOutput;
      }
      
      const result = await placeMarketOrder(
        book.bookId,
        book.isBuy,
        orderAmount,
        parseFloat(slippage) * 100 // Convert percentage to basis points
      );
      
      if (result.success) {
        Alert.alert(
          'Swap Successful!',
          `Swapped ${fromAmount} ${fromToken.symbol} for ~${estimatedOutput} ${toToken.symbol}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setFromAmount('');
                refreshPortfolio();
              },
            },
          ]
        );
      } else {
        Alert.alert('Swap Failed', result.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      logError('SimpleSwapWidget', 'Swap failed', error);
      Alert.alert('Error', error.message || 'Failed to execute swap');
    } finally {
      setLoading(false);
    }
  };
  
  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
  };
  
  const setMaxAmount = () => {
    setFromAmount(availableBalance);
  };
  
  const isReady = isInitialized && delegationStatus === 'ready';
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Quick Swap</Text>
        <Text style={styles.subtitle}>Market orders with instant execution</Text>
      </View>
      
      {/* From Token */}
      <View style={styles.tokenSection}>
        <Text style={styles.label}>From</Text>
        <View style={styles.tokenRow}>
          <View style={styles.tokenSelector}>
            <TouchableOpacity
              style={styles.tokenButton}
              onPress={() => {
                // Token selector modal would go here
                const nextToken = TOKENS.find(t => 
                  t.symbol !== fromToken.symbol && t.symbol !== toToken.symbol
                );
                if (nextToken) setFromToken(nextToken);
              }}
            >
              <Text style={styles.tokenSymbol}>{fromToken.symbol}</Text>
              <Text style={styles.tokenArrow}>▼</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.amountContainer}>
            <TextInput
              style={styles.amountInput}
              value={fromAmount}
              onChangeText={setFromAmount}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity onPress={setMaxAmount} style={styles.maxButton}>
              <Text style={styles.maxText}>MAX</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.balanceRow}>
          <Text style={styles.balanceText}>
            Balance: {availableBalance} {fromToken.symbol}
          </Text>
          <Text style={styles.valueText}>
            ≈ ${(parseFloat(availableBalance) * fromToken.price).toFixed(2)}
          </Text>
        </View>
      </View>
      
      {/* Switch Button */}
      <TouchableOpacity style={styles.switchButton} onPress={switchTokens}>
        <Text style={styles.switchIcon}>⇅</Text>
      </TouchableOpacity>
      
      {/* To Token */}
      <View style={styles.tokenSection}>
        <Text style={styles.label}>To (estimated)</Text>
        <View style={styles.tokenRow}>
          <View style={styles.tokenSelector}>
            <TouchableOpacity
              style={styles.tokenButton}
              onPress={() => {
                // Token selector modal would go here
                const nextToken = TOKENS.find(t => 
                  t.symbol !== fromToken.symbol && t.symbol !== toToken.symbol
                );
                if (nextToken) setToToken(nextToken);
              }}
            >
              <Text style={styles.tokenSymbol}>{toToken.symbol}</Text>
              <Text style={styles.tokenArrow}>▼</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={styles.outputAmount}>{estimatedOutput}</Text>
          </View>
        </View>
        
        <Text style={styles.valueText}>
          ≈ ${(parseFloat(estimatedOutput) * toToken.price).toFixed(2)}
        </Text>
      </View>
      
      {/* Slippage Settings */}
      <View style={styles.slippageSection}>
        <Text style={styles.slippageLabel}>Max Slippage</Text>
        <View style={styles.slippageButtons}>
          {['0.5', '1', '2', '5'].map((value) => (
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
      
      {/* Exchange Rate */}
      {fromAmount && parseFloat(fromAmount) > 0 && (
        <View style={styles.rateSection}>
          <Text style={styles.rateText}>
            1 {fromToken.symbol} = {(toToken.price / fromToken.price).toFixed(6)} {toToken.symbol}
          </Text>
          <Text style={styles.feeText}>Fee: 0.2% (taker)</Text>
        </View>
      )}
      
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
        ) : !isReady ? (
          <Text style={styles.swapButtonText}>Setup Required</Text>
        ) : (
          <Text style={styles.swapButtonText}>Swap</Text>
        )}
      </TouchableOpacity>
      
      {!isReady && (
        <Text style={styles.warningText}>
          Please complete account setup to start swapping
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    margin: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  tokenSection: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tokenSelector: {
    width: 100,
  },
  tokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tokenArrow: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  amountContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  outputAmount: {
    fontSize: 18,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  maxText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
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
  valueText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  switchButton: {
    alignSelf: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  switchIcon: {
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  slippageSection: {
    marginTop: 16,
    marginBottom: 12,
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
    backgroundColor: COLORS.background,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  slippageButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  slippageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  slippageTextActive: {
    color: COLORS.primary,
  },
  rateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundTertiary,
    marginBottom: 16,
  },
  rateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  feeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  swapButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
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
  warningText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
    color: COLORS.warning,
  },
});