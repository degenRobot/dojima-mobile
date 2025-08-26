import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { usePorto } from '../../providers/PortoProvider';
import { COLORS, ORDER_TYPES, ORDER_SIDES } from '../../config/constants';
import { encodeFunctionData } from 'viem';
import { CONTRACTS } from '../../config/contracts';

interface OrderFormProps {
  pair: { base: string; quote: string; symbol: string };
}

export function OrderForm({ pair }: OrderFormProps) {
  const { executeTransaction, delegationStatus } = usePorto();
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('0.00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total when price or amount changes
  React.useEffect(() => {
    if (price && amount) {
      const totalValue = (parseFloat(price) * parseFloat(amount)).toFixed(2);
      setTotal(totalValue);
    } else {
      setTotal('0.00');
    }
  }, [price, amount]);

  const handleSubmit = async () => {
    if (delegationStatus !== 'deployed') {
      Alert.alert('Not Ready', 'Please wait for gasless setup to complete');
      return;
    }

    if (!price || !amount) {
      Alert.alert('Invalid Order', 'Please enter price and amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare order data for CLOB contract
      // Note: This is simplified - actual implementation would need proper encoding
      const orderData = encodeFunctionData({
        abi: [{
          name: orderType === 'limit' ? 'placeLimitOrder' : 'placeMarketOrder',
          type: 'function',
          inputs: [
            { name: 'side', type: 'uint8' },
            { name: 'price', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
          ],
        }],
        functionName: orderType === 'limit' ? 'placeLimitOrder' : 'placeMarketOrder',
        args: [
          orderSide === 'buy' ? 0 : 1, // 0 for buy, 1 for sell
          BigInt(Math.floor(parseFloat(price) * 1e18)), // Convert to wei
          BigInt(Math.floor(parseFloat(amount) * 1e18)), // Convert to wei
        ],
      });

      const result = await executeTransaction(
        CONTRACTS.EnhancedSpotBook.address,
        orderData
      );

      if (result.success) {
        Alert.alert('Success', 'Order placed successfully');
        // Clear form
        setPrice('');
        setAmount('');
      } else {
        Alert.alert('Error', 'Failed to place order');
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      Alert.alert('Error', 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Order Type Selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, orderType === 'limit' && styles.typeButtonActive]}
          onPress={() => setOrderType('limit')}
        >
          <Text style={[styles.typeButtonText, orderType === 'limit' && styles.typeButtonTextActive]}>
            Limit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, orderType === 'market' && styles.typeButtonActive]}
          onPress={() => setOrderType('market')}
        >
          <Text style={[styles.typeButtonText, orderType === 'market' && styles.typeButtonTextActive]}>
            Market
          </Text>
        </TouchableOpacity>
      </View>

      {/* Buy/Sell Toggle */}
      <View style={styles.sideToggle}>
        <TouchableOpacity
          style={[styles.sideButton, orderSide === 'buy' && styles.buyButtonActive]}
          onPress={() => setOrderSide('buy')}
        >
          <Text style={[styles.sideButtonText, orderSide === 'buy' && styles.sideButtonTextActive]}>
            Buy {pair.base}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sideButton, orderSide === 'sell' && styles.sellButtonActive]}
          onPress={() => setOrderSide('sell')}
        >
          <Text style={[styles.sideButtonText, orderSide === 'sell' && styles.sideButtonTextActive]}>
            Sell {pair.base}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Price Input (for limit orders) */}
      {orderType === 'limit' && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Price ({pair.quote})</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Amount ({pair.base})</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Total Display */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{total} {pair.quote}</Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          orderSide === 'buy' ? styles.buyButton : styles.sellButton,
          isSubmitting && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Placing Order...' : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${pair.base}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: COLORS.backgroundTertiary,
    borderRadius: 8,
    padding: 2,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeButtonActive: {
    backgroundColor: COLORS.background,
  },
  typeButtonText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: COLORS.textPrimary,
  },
  sideToggle: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  sideButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  buyButtonActive: {
    backgroundColor: COLORS.buyColor,
    borderColor: COLORS.buyColor,
  },
  sellButtonActive: {
    backgroundColor: COLORS.sellColor,
    borderColor: COLORS.sellColor,
  },
  sideButtonText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sideButtonTextActive: {
    color: COLORS.textPrimary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
    borderTopWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: COLORS.buyColor,
  },
  sellButton: {
    backgroundColor: COLORS.sellColor,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});