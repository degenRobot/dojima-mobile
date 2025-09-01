import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { usePorto } from '../../providers/SimplePortoProvider';
import { useCLOBContract } from '../../hooks/useCLOBContract';
import { usePortfolio } from '../../hooks/usePortfolio';
import { COLORS, ORDER_TYPES, ORDER_SIDES } from '../../config/constants';
import { logInfo, logError, logDebug } from '../../utils/logger';
import { formatUnits } from 'viem';

interface OrderFormProps {
  pair: {
    id?: number;
    base: string;
    quote: string;
    symbol: string;
  };
}

export function OrderForm({ pair }: OrderFormProps) {
  const { delegationStatus, isInitialized } = usePorto();
  const { placeOrder, placeMarketOrder, loading } = useCLOBContract();
  const { portfolio, getTokenInfo } = usePortfolio();
  
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('0.00');
  const [slippage, setSlippage] = useState('1'); // Default 1% slippage
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  
  // Calculate available balance based on order side - using same data source as Portfolio
  const availableBalance = useMemo(() => {
    if (!portfolio || !pair) return '0';
    const tokenSymbol = orderSide === 'buy' ? pair.quote : pair.base;
    const tokenInfo = getTokenInfo(tokenSymbol);
    
    // Use CLOB available balance (not locked)
    return tokenInfo?.clobBalance || '0';
  }, [portfolio, pair, orderSide, getTokenInfo]);
  
  // Handle percentage selection
  const handlePercentageClick = (percentage: number) => {
    setSelectedPercentage(percentage);
    const balanceValue = parseFloat(availableBalance);
    
    if (orderSide === 'buy') {
      if (orderType === 'limit' && price) {
        // For buy limit orders, calculate how much base token we can buy with our quote balance
        const priceValue = parseFloat(price);
        const maxAmount = (balanceValue / priceValue * percentage / 100).toFixed(6);
        setAmount(maxAmount);
      } else if (orderType === 'market') {
        // For market buy orders, amount is quote token to spend
        const newAmount = (balanceValue * percentage / 100).toFixed(2);
        setAmount(newAmount);
      }
    } else {
      // For sell orders (both limit and market), use base token balance
      const newAmount = (balanceValue * percentage / 100).toFixed(6);
      setAmount(newAmount);
    }
  };

  // Log component mount
  React.useEffect(() => {
    logDebug('OrderForm', 'Component mounted', { 
      pair: pair?.symbol || 'unknown',
      delegationStatus,
      isInitialized 
    });
  }, []);

  // Calculate total when price or amount changes
  React.useEffect(() => {
    try {
      if (orderType === 'limit' && price && amount) {
        const priceNum = parseFloat(price);
        const amountNum = parseFloat(amount);
        
        if (!isNaN(priceNum) && !isNaN(amountNum)) {
          const totalValue = (priceNum * amountNum).toFixed(2);
          setTotal(totalValue);
        } else {
          setTotal('0.00');
        }
      } else if (orderType === 'market' && amount) {
        // For market orders, show different message based on order side
        if (orderSide === 'buy') {
          setTotal('Spending ' + amount + ' ' + (pair?.quote || 'USD'));
        } else {
          setTotal('Selling ' + amount + ' ' + (pair?.base || 'TOKEN'));
        }
      } else {
        setTotal('0.00');
      }
    } catch (error) {
      logError('OrderForm', 'Failed to calculate total', { error, price, amount });
      setTotal('0.00');
    }
  }, [price, amount, orderType]);

  const handleSubmit = async () => {
    try {
      // Validation
      if (!isInitialized) {
        Alert.alert('Not Ready', 'Wallet is not initialized');
        return;
      }

      if (delegationStatus !== 'ready') {
        Alert.alert('Not Ready', 'Please setup delegation first (go to Settings)');
        return;
      }

      if (!amount) {
        Alert.alert('Invalid Order', 'Please enter an amount');
        return;
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid amount');
        return;
      }

      // Check if user has sufficient CLOB balance
      const availableNum = parseFloat(availableBalance);
      if (orderSide === 'sell') {
        // For sell orders, check base token balance
        if (amountNum > availableNum) {
          Alert.alert('Insufficient Balance', 
            `You only have ${availableBalance} ${pair?.base || 'TOKEN'} available in CLOB. Please deposit more funds first.`);
          return;
        }
      } else if (orderSide === 'buy') {
        // For buy orders, check quote token balance
        if (orderType === 'limit' && price) {
          // For limit orders, calculate exact required amount
          const requiredQuote = amountNum * parseFloat(price);
          if (requiredQuote > availableNum) {
            Alert.alert('Insufficient Balance', 
              `You need ${requiredQuote.toFixed(2)} ${pair?.quote || 'USD'} but only have ${availableBalance} available in CLOB. Please deposit more funds first.`);
            return;
          }
        } else if (orderType === 'market') {
          // For market buy orders, amount represents how much quote token to spend
          // The user enters the amount of quote token they want to spend
          if (amountNum > availableNum) {
            Alert.alert('Insufficient Balance', 
              `You only have ${availableBalance} ${pair?.quote || 'USD'} available in CLOB. Please deposit more funds first.`);
            return;
          }
        }
      }

      // For limit orders, also validate price
      if (orderType === 'limit') {
        if (!price) {
          Alert.alert('Invalid Order', 'Please enter a price for limit orders');
          return;
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
          Alert.alert('Invalid Price', 'Please enter a valid price');
          return;
        }
      }

      // Get book ID from pair
      const bookId = pair?.id || 1; // Default to book 1 (WETH/USDC)

      setIsSubmitting(true);
      
      let result;
      if (orderType === 'market') {
        // Place market order with slippage protection
        const slippageBps = Math.round(parseFloat(slippage || '1') * 100); // Convert percentage to basis points
        
        // For market orders:
        // - Buy: amount is in quote token (USDC) - need to convert to base token estimate
        // - Sell: amount is already in base token
        let marketOrderAmount = amount;
        if (orderSide === 'buy') {
          // Convert USDC amount to estimated base token amount
          // This is a rough estimate - the actual amount will be determined by the contract
          const estimatedPrice = pair?.base === 'WBTC' ? 65000 : pair?.base === 'WETH' ? 2500 : 1;
          marketOrderAmount = (amountNum / estimatedPrice).toFixed(8);
        }
        
        logInfo('OrderForm', 'Submitting market order', {
          bookId,
          side: orderSide,
          originalAmount: amount,
          marketOrderAmount,
          slippageBps,
        });
        
        result = await placeMarketOrder(
          bookId,
          orderSide === 'buy',
          marketOrderAmount,
          slippageBps
        );
      } else {
        // Place limit order
        logInfo('OrderForm', 'Submitting limit order', {
          bookId,
          side: orderSide,
          price: price,
          amount: amountNum,
          total,
        });
        
        result = await placeOrder(
          bookId,
          orderSide === 'buy',
          price,
          amount
        );
      }

      if (result.success) {
        logInfo('OrderForm', 'Order placed successfully', { bundleId: result.bundleId });
        Alert.alert('Success', 'Order placed successfully!');
        // Clear form
        setPrice('');
        setAmount('');
        setTotal('0.00');
      } else {
        throw new Error(result.error || 'Failed to place order');
      }
    } catch (error: any) {
      logError('OrderForm', 'Order submission failed', { error: error.message });
      Alert.alert('Order Failed', error.message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = loading || isSubmitting || delegationStatus !== 'ready';

  return (
    <View style={styles.container}>
      {/* Order Type Selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, orderType === 'limit' && styles.typeButtonActive]}
          onPress={() => setOrderType('limit')}
        >
          <Text style={[styles.typeText, orderType === 'limit' && styles.typeTextActive]}>
            Limit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, orderType === 'market' && styles.typeButtonActive]}
          onPress={() => setOrderType('market')}
        >
          <Text style={[styles.typeText, orderType === 'market' && styles.typeTextActive]}>
            Market
          </Text>
        </TouchableOpacity>
      </View>

      {/* Buy/Sell Selector */}
      <View style={styles.sideSelector}>
        <TouchableOpacity
          style={[styles.buyButton, orderSide === 'buy' && styles.buyButtonActive]}
          onPress={() => setOrderSide('buy')}
        >
          <Text style={[styles.sideText, orderSide === 'buy' && styles.sideTextActive]}>
            Buy {pair?.base || 'TOKEN'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sellButton, orderSide === 'sell' && styles.sellButtonActive]}
          onPress={() => setOrderSide('sell')}
        >
          <Text style={[styles.sideText, orderSide === 'sell' && styles.sideTextActive]}>
            Sell {pair?.base || 'TOKEN'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Price Input (only for limit orders) */}
      {orderType === 'limit' && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Price ({pair?.quote || 'USD'})</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {/* Slippage Input (only for market orders) */}
      {orderType === 'market' && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Max Slippage (%)</Text>
          <TextInput
            style={styles.input}
            value={slippage}
            onChangeText={setSlippage}
            placeholder="1.0"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {/* Amount Input with Balance and Percentage Selector */}
      <View style={styles.inputContainer}>
        <View style={styles.inputHeader}>
          <Text style={styles.inputLabel}>
            Amount ({orderType === 'market' && orderSide === 'buy' ? pair?.quote || 'USD' : pair?.base || 'TOKEN'})
          </Text>
          <Text style={styles.balanceLabel}>
            CLOB Balance: {parseFloat(availableBalance).toFixed(4)} {orderSide === 'buy' ? pair?.quote : pair?.base}
          </Text>
        </View>
        
        {/* Percentage Selector */}
        <View style={styles.percentageSelector}>
          {[25, 50, 75, 100].map(pct => (
            <TouchableOpacity
              key={pct}
              style={[
                styles.percentageButton,
                selectedPercentage === pct && styles.percentageButtonActive
              ]}
              onPress={() => handlePercentageClick(pct)}
            >
              <Text style={[
                styles.percentageButtonText,
                selectedPercentage === pct && styles.percentageButtonTextActive
              ]}>
                {pct === 100 ? 'MAX' : `${pct}%`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(text) => {
            setAmount(text);
            setSelectedPercentage(null);
          }}
          placeholder={orderType === 'market' && orderSide === 'buy' ? 
            `Enter ${pair?.quote || 'USD'} amount to spend` : 
            `Enter ${pair?.base || 'TOKEN'} amount`}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Total Display */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{total} {pair?.quote || 'USD'}</Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          orderSide === 'buy' ? styles.buySubmitButton : styles.sellSubmitButton,
          isDisabled && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isDisabled}
      >
        {isSubmitting ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>
            {delegationStatus !== 'ready' 
              ? 'Setup Delegation First'
              : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${pair?.base || 'TOKEN'}`
            }
          </Text>
        )}
      </TouchableOpacity>

      {/* Status Message */}
      {delegationStatus !== 'ready' && (
        <Text style={styles.statusMessage}>
          ⚠️ Go to Settings to setup gasless trading
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: COLORS.background,
    marginHorizontal: 4,
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeButtonDisabled: {
    opacity: 0.5,
  },
  typeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  typeTextActive: {
    color: COLORS.background,
  },
  typeTextDisabled: {
    color: COLORS.textMuted,
  },
  sideSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  buyButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: COLORS.background,
    marginRight: 4,
    borderWidth: 1,
    borderColor: COLORS.buyColor,
  },
  buyButtonActive: {
    backgroundColor: COLORS.buyColor,
  },
  sellButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: COLORS.background,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: COLORS.sellColor,
  },
  sellButtonActive: {
    backgroundColor: COLORS.sellColor,
  },
  sideText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sideTextActive: {
    color: COLORS.background,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buySubmitButton: {
    backgroundColor: COLORS.buyColor,
  },
  sellSubmitButton: {
    backgroundColor: COLORS.sellColor,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    color: COLORS.background,
    fontWeight: '600',
  },
  statusMessage: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.warning,
    textAlign: 'center',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 11,
    color: COLORS.primary,
  },
  percentageSelector: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 6,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
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
    fontSize: 11,
    fontWeight: '600',
  },
  percentageButtonTextActive: {
    color: COLORS.primary,
  },
});