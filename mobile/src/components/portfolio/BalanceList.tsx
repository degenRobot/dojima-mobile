import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../../config/constants';

interface Balance {
  id: string;
  token: string;
  balance: string;
  value: string;
  change24h: string;
  isPositive: boolean;
}

const mockBalances: Balance[] = [
  {
    id: '1',
    token: 'WETH',
    balance: '5.2345',
    value: '$12,234.56',
    change24h: '+5.23%',
    isPositive: true,
  },
  {
    id: '2',
    token: 'USDC',
    balance: '10,000.00',
    value: '$10,000.00',
    change24h: '0.00%',
    isPositive: true,
  },
  {
    id: '3',
    token: 'RISE',
    balance: '25,000',
    value: '$11,417.50',
    change24h: '-2.45%',
    isPositive: false,
  },
];

export function BalanceList() {
  const renderBalance = ({ item }: { item: Balance }) => (
    <TouchableOpacity style={styles.balanceItem} activeOpacity={0.7}>
      <View style={styles.tokenInfo}>
        <Text style={styles.tokenSymbol}>{item.token}</Text>
        <Text style={styles.balance}>{item.balance}</Text>
      </View>
      <View style={styles.valueInfo}>
        <Text style={styles.value}>{item.value}</Text>
        <Text style={[
          styles.change,
          item.isPositive ? styles.changePositive : styles.changeNegative,
        ]}>
          {item.change24h}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mockBalances}
        renderItem={renderBalance}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  balanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  balance: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  valueInfo: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  change: {
    fontSize: 14,
  },
  changePositive: {
    color: COLORS.success,
  },
  changeNegative: {
    color: COLORS.error,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.backgroundTertiary,
  },
});