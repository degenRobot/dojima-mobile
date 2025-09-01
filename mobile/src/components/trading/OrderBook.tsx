import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS, UI_CONFIG } from '../../config/constants';
import { logDebug, logError, logInfo } from '../../utils/logger';
import { useOrderBook, isIndexerAvailable } from '../../hooks/useIndexer';
import { useOrderBookFromContract } from '../../hooks/useOrderBookFromContract';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../../config/contracts';

interface OrderBookProps {
  pair: {
    id?: number;
    base: string;
    quote: string;
    symbol: string;
  };
}

interface OrderLevel {
  price: string;
  amount: string;
  total: string;
  percentage: number;
}

export function OrderBook({ pair }: OrderBookProps) {
  // Get book ID
  const bookId = pair?.id || 1;
  
  // Use real data from contract
  const { 
    orderBook: contractOrderBook, 
    loading: contractLoading, 
    error: contractError, 
    refetch 
  } = useOrderBookFromContract(bookId);
  
  // Fallback: Use indexer data if available
  const { data: indexerData, isLoading: indexerLoading } = useOrderBook(bookId.toString());
  
  // Log data source
  useEffect(() => {
    if (contractOrderBook.buyOrders.length > 0 || contractOrderBook.sellOrders.length > 0) {
      logInfo('OrderBook', 'Using real contract data', {
        bookId,
        buys: contractOrderBook.buyOrders.length,
        sells: contractOrderBook.sellOrders.length,
      });
    } else if (indexerData && !contractLoading) {
      logDebug('OrderBook', 'Using indexer data as fallback');
    } else if (!contractLoading && !indexerLoading) {
      logDebug('OrderBook', 'No order book data available');
    }
  }, [contractOrderBook, indexerData, contractLoading, indexerLoading, bookId]);

  // Process data: prefer contract data, then indexer
  const { bids, asks, spread, spreadPercent } = useMemo(() => {
    // First try: Use contract data if available
    if (contractOrderBook.buyOrders.length > 0 || contractOrderBook.sellOrders.length > 0) {
      const maxBidAmount = Math.max(...contractOrderBook.buyOrders.map(o => parseFloat(o.total || '0')), 1);
      const maxAskAmount = Math.max(...contractOrderBook.sellOrders.map(o => parseFloat(o.total || '0')), 1);
      
      const processedBids = contractOrderBook.buyOrders.map((order) => ({
        ...order,
        percentage: (parseFloat(order.total || '0') / maxBidAmount) * 100,
      }));
      
      const processedAsks = contractOrderBook.sellOrders.map((order) => ({
        ...order,
        percentage: (parseFloat(order.total || '0') / maxAskAmount) * 100,
      }));
      
      const bestBid = processedBids[0]?.price || '0';
      const bestAsk = processedAsks[0]?.price || '0';
      const spreadValue = parseFloat(contractOrderBook.spread);
      const spreadPct = bestBid && bestAsk && parseFloat(bestBid) > 0 ? 
        ((spreadValue / parseFloat(bestBid)) * 100).toFixed(2) : '0.00';
      
      return {
        bids: processedBids.slice(0, 10),
        asks: processedAsks.slice(0, 10),
        spread: contractOrderBook.spread,
        spreadPercent: spreadPct,
      };
    }
    
    // Second try: Use indexer data if available
    if (isIndexerAvailable() && indexerData) {
      const data = indexerData as any;
      const processedBids = (data.buyOrders || []).map((order: any) => ({
        price: formatUnits(BigInt(order.price || '0'), CONTRACTS.USDC.decimals),
        amount: formatUnits(BigInt(order.remaining || '0'), 18),
        total: (parseFloat(formatUnits(BigInt(order.price || '0'), CONTRACTS.USDC.decimals)) * 
                parseFloat(formatUnits(BigInt(order.remaining || '0'), 18))).toFixed(2),
        percentage: 50, // Default percentage
      }));
      
      const processedAsks = (data.sellOrders || []).map((order: any) => ({
        price: formatUnits(BigInt(order.price || '0'), CONTRACTS.USDC.decimals),
        amount: formatUnits(BigInt(order.remaining || '0'), 18),
        total: (parseFloat(formatUnits(BigInt(order.price || '0'), CONTRACTS.USDC.decimals)) * 
                parseFloat(formatUnits(BigInt(order.remaining || '0'), 18))).toFixed(2),
        percentage: 50, // Default percentage
      }));
      
      const bestBid = processedBids[0]?.price || '0';
      const bestAsk = processedAsks[0]?.price || '0';
      const spreadValue = parseFloat(bestAsk) - parseFloat(bestBid);
      const spreadPct = bestBid && parseFloat(bestBid) > 0 ? 
        ((spreadValue / parseFloat(bestBid)) * 100).toFixed(2) : '0.00';
      
      return {
        bids: processedBids.slice(0, 10),
        asks: processedAsks.slice(0, 10),
        spread: spreadValue.toFixed(2),
        spreadPercent: spreadPct,
      };
    }
    
    // No data available
    return {
      bids: [],
      asks: [],
      spread: '0',
      spreadPercent: '0.00',
    };
  }, [contractOrderBook, indexerData]);

  const renderOrderLevel = (item: OrderLevel, type: 'bid' | 'ask') => {
    return (
      <TouchableOpacity style={styles.orderRow} activeOpacity={0.7} key={`${type}-${item.price}`}>
        <View style={[
          styles.depthBar,
          type === 'bid' ? styles.bidDepthBar : styles.askDepthBar,
          { width: `${Math.min(item.percentage, 100)}%` },
        ]} />
        <Text style={[
          styles.priceText,
          type === 'bid' ? styles.bidText : styles.askText,
        ]}>
          {item.price}
        </Text>
        <Text style={styles.amountText}>{item.amount}</Text>
        <Text style={styles.totalText}>{item.total}</Text>
      </TouchableOpacity>
    );
  };

  // Loading state
  const isLoading = contractLoading && !contractOrderBook.buyOrders.length && !indexerData;
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading order book...</Text>
      </View>
    );
  }
  
  // Error state (only if no fallback data)
  if (contractError && !indexerData && bids.length === 0 && asks.length === 0) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Failed to load order book</Text>
        <TouchableOpacity onPress={refetch} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Error handling for missing pair
  if (!pair) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No trading pair selected</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Price ({pair.quote})</Text>
        <Text style={styles.headerText}>Amount ({pair.base})</Text>
        <Text style={styles.headerText}>Total</Text>
      </View>

      {/* Sell Orders (Asks) */}
      <View style={styles.asksContainer}>
        {asks.length > 0 ? (
          [...asks].reverse().map(ask => renderOrderLevel(ask, 'ask'))
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No sell orders</Text>
          </View>
        )}
      </View>

      {/* Spread */}
      <View style={styles.spreadContainer}>
        <Text style={styles.spreadLabel}>Spread</Text>
        <Text style={styles.spreadValue}>
          ${spread} ({spreadPercent}%)
        </Text>
      </View>

      {/* Buy Orders (Bids) */}
      <View style={styles.bidsContainer}>
        {bids.length > 0 ? (
          bids.map(bid => renderOrderLevel(bid, 'bid'))
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No buy orders</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  headerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  asksContainer: {
    flex: 1,
    maxHeight: 200,
  },
  bidsContainer: {
    flex: 1,
    maxHeight: 200,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    position: 'relative',
  },
  depthBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  bidDepthBar: {
    backgroundColor: COLORS.buyColor,
  },
  askDepthBar: {
    backgroundColor: COLORS.sellColor,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  bidText: {
    color: COLORS.buyColor,
  },
  askText: {
    color: COLORS.sellColor,
  },
  amountText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  totalText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  spreadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  spreadLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  spreadValue: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});