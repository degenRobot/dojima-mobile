import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { COLORS } from '../../config/constants';

interface Position {
  id: string;
  pair: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  pnlPercent: string;
  isProfit: boolean;
}

const mockPositions: Position[] = [
  {
    id: '1',
    pair: 'WETH/USDC',
    side: 'long',
    size: '2.5',
    entryPrice: '$2,300.00',
    currentPrice: '$2,345.67',
    pnl: '+$114.18',
    pnlPercent: '+1.98%',
    isProfit: true,
  },
  {
    id: '2',
    pair: 'RISE/USDC',
    side: 'short',
    size: '10,000',
    entryPrice: '$0.4800',
    currentPrice: '$0.4567',
    pnl: '+$233.00',
    pnlPercent: '+4.85%',
    isProfit: true,
  },
];

export function PositionList() {
  const renderPosition = ({ item }: { item: Position }) => (
    <View style={styles.positionCard}>
      <View style={styles.positionHeader}>
        <Text style={styles.pair}>{item.pair}</Text>
        <View style={[
          styles.sideBadge,
          item.side === 'long' ? styles.longBadge : styles.shortBadge,
        ]}>
          <Text style={styles.sideText}>
            {item.side.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.positionDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Size</Text>
          <Text style={styles.detailValue}>{item.size}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Entry</Text>
          <Text style={styles.detailValue}>{item.entryPrice}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Current</Text>
          <Text style={styles.detailValue}>{item.currentPrice}</Text>
        </View>
      </View>
      
      <View style={styles.pnlContainer}>
        <Text style={[
          styles.pnl,
          item.isProfit ? styles.pnlProfit : styles.pnlLoss,
        ]}>
          {item.pnl}
        </Text>
        <Text style={[
          styles.pnlPercent,
          item.isProfit ? styles.pnlProfit : styles.pnlLoss,
        ]}>
          {item.pnlPercent}
        </Text>
      </View>
    </View>
  );

  if (mockPositions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No open positions</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={mockPositions}
        renderItem={renderPosition}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  positionCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pair: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  sideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  longBadge: {
    backgroundColor: COLORS.buyColor,
  },
  shortBadge: {
    backgroundColor: COLORS.sellColor,
  },
  sideText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  positionDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  pnlContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundTertiary,
  },
  pnl: {
    fontSize: 16,
    fontWeight: '600',
  },
  pnlPercent: {
    fontSize: 16,
    fontWeight: '600',
  },
  pnlProfit: {
    color: COLORS.success,
  },
  pnlLoss: {
    color: COLORS.error,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
});