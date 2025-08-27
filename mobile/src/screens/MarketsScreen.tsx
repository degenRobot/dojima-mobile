import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWalletStore } from '../store/walletStore';
import { CONTRACTS } from '../config/contracts';
import { COLORS } from '../config/constants';
import { publicClient } from '../config/viemClient';
import { formatUnits } from 'viem';
import { useOrderPlacement } from '../hooks/useOrderPlacement';

interface Order {
  id: bigint;
  trader: string;
  bookId: number;
  orderType: number;
  price: bigint;
  amount: bigint;
  filled: bigint;
  status: number;
  timestamp: bigint;
}

interface TradingBook {
  id: number;
  name: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
}

const TRADING_BOOKS: TradingBook[] = [
  {
    id: 1,
    name: 'WETH/USDC',
    baseSymbol: 'WETH',
    quoteSymbol: 'USDC',
    baseDecimals: 18,
    quoteDecimals: 6,
  },
  {
    id: 2,
    name: 'WBTC/USDC',
    baseSymbol: 'WBTC',
    quoteSymbol: 'USDC',
    baseDecimals: 8,
    quoteDecimals: 6,
  },
];

const ORDER_STATUS = ['ACTIVE', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'];

export function MarketsScreen() {
  const { wallet } = useWalletStore();
  const [selectedBook, setSelectedBook] = useState<TradingBook>(TRADING_BOOKS[0]);
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'orderbook' | 'myorders'>('orderbook');
  const { matchOrders, cancelOrder } = useOrderPlacement();

  // Fetch order book
  const fetchOrderBook = async () => {
    setLoading(true);
    try {
      // Get order IDs from contract
      const [buyOrderIds, sellOrderIds] = await publicClient.readContract({
        address: CONTRACTS.UnifiedCLOB.address,
        abi: CONTRACTS.UnifiedCLOB.abi,
        functionName: 'getOrderBook',
        args: [BigInt(selectedBook.id)],
      }) as [bigint[], bigint[]];

      // Fetch buy order details
      const buyOrderPromises = buyOrderIds.map(async (orderId) => {
        const orderData = await publicClient.readContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'getOrder',
          args: [orderId],
        }) as any;

        return {
          id: orderData[0],
          trader: orderData[1],
          bookId: Number(orderData[2]),
          orderType: Number(orderData[3]),
          price: orderData[4],
          amount: orderData[5],
          filled: orderData[6],
          status: Number(orderData[7]),
          timestamp: orderData[8],
        } as Order;
      });

      // Fetch sell order details
      const sellOrderPromises = sellOrderIds.map(async (orderId) => {
        const orderData = await publicClient.readContract({
          address: CONTRACTS.UnifiedCLOB.address,
          abi: CONTRACTS.UnifiedCLOB.abi,
          functionName: 'getOrder',
          args: [orderId],
        }) as any;

        return {
          id: orderData[0],
          trader: orderData[1],
          bookId: Number(orderData[2]),
          orderType: Number(orderData[3]),
          price: orderData[4],
          amount: orderData[5],
          filled: orderData[6],
          status: Number(orderData[7]),
          timestamp: orderData[8],
        } as Order;
      });

      const [fetchedBuyOrders, fetchedSellOrders] = await Promise.all([
        Promise.all(buyOrderPromises),
        Promise.all(sellOrderPromises),
      ]);

      setBuyOrders(fetchedBuyOrders);
      setSellOrders(fetchedSellOrders);

      // Filter user orders
      if (wallet) {
        const userOrderList = [...fetchedBuyOrders, ...fetchedSellOrders].filter(
          (order) => order.trader.toLowerCase() === wallet.address.toLowerCase()
        );
        setUserOrders(userOrderList);
      }
    } catch (error) {
      console.error('Failed to fetch order book:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderBook();
  }, [selectedBook, wallet]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrderBook();
  };

  const handleMatchOrders = async () => {
    try {
      Alert.alert(
        'Match Orders',
        `This will attempt to match crossing orders in the ${selectedBook.name} market. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Match',
            onPress: async () => {
              setLoading(true);
              try {
                const matchCount = await matchOrders(selectedBook.id);
                Alert.alert(
                  'Matching Complete',
                  `Successfully matched ${matchCount} order${matchCount !== 1 ? 's' : ''}`
                );
                fetchOrderBook();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to match orders');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to match orders');
    }
  };

  const handleCancelOrder = (orderId: bigint) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await cancelOrder(orderId);
              Alert.alert('Success', 'Order cancelled successfully');
              fetchOrderBook();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel order');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderOrderItem = ({ item, type }: { item: Order; type: 'buy' | 'sell' }) => {
    const remaining = item.amount - item.filled;
    const price = formatUnits(item.price, selectedBook.quoteDecimals);
    const amount = formatUnits(remaining, 18); // Amount is normalized to 18 decimals
    const total = (parseFloat(price) * parseFloat(amount)).toFixed(selectedBook.quoteDecimals);

    return (
      <View style={[styles.orderItem, type === 'buy' ? styles.buyOrder : styles.sellOrder]}>
        <Text style={styles.orderPrice}>{price}</Text>
        <Text style={styles.orderAmount}>{amount}</Text>
        <Text style={styles.orderTotal}>{total}</Text>
      </View>
    );
  };

  const renderUserOrder = ({ item }: { item: Order }) => {
    const isActive = item.status === 0;
    const isBuy = item.orderType === 0;
    const price = formatUnits(item.price, selectedBook.quoteDecimals);
    const amount = formatUnits(item.amount, 18);
    const filled = formatUnits(item.filled, 18);

    return (
      <View style={styles.userOrderItem}>
        <View style={styles.userOrderHeader}>
          <View style={[styles.orderTypeBadge, isBuy ? styles.buyBadge : styles.sellBadge]}>
            <Text style={styles.orderTypeBadgeText}>{isBuy ? 'BUY' : 'SELL'}</Text>
          </View>
          <Text style={[styles.orderStatus, { color: isActive ? COLORS.warning : COLORS.textMuted }]}>
            {ORDER_STATUS[item.status]}
          </Text>
        </View>
        
        <View style={styles.userOrderDetails}>
          <View style={styles.userOrderRow}>
            <Text style={styles.userOrderLabel}>Price:</Text>
            <Text style={styles.userOrderValue}>{price} {selectedBook.quoteSymbol}</Text>
          </View>
          <View style={styles.userOrderRow}>
            <Text style={styles.userOrderLabel}>Amount:</Text>
            <Text style={styles.userOrderValue}>{amount} {selectedBook.baseSymbol}</Text>
          </View>
          <View style={styles.userOrderRow}>
            <Text style={styles.userOrderLabel}>Filled:</Text>
            <Text style={styles.userOrderValue}>{filled} {selectedBook.baseSymbol}</Text>
          </View>
        </View>

        {isActive && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelOrder(item.id)}
          >
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const calculateSpread = () => {
    if (buyOrders.length === 0 || sellOrders.length === 0) return 'N/A';
    
    const bestBid = buyOrders[0]?.price || 0n;
    const bestAsk = sellOrders[0]?.price || 0n;
    
    if (bestBid === 0n || bestAsk === 0n) return 'N/A';
    
    const spread = formatUnits(bestAsk - bestBid, selectedBook.quoteDecimals);
    return spread;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Market Selector */}
        <View style={styles.marketSelector}>
          {TRADING_BOOKS.map((book) => (
            <TouchableOpacity
              key={book.id}
              style={[
                styles.marketButton,
                selectedBook.id === book.id && styles.marketButtonActive,
              ]}
              onPress={() => setSelectedBook(book)}
            >
              <Text
                style={[
                  styles.marketButtonText,
                  selectedBook.id === book.id && styles.marketButtonTextActive,
                ]}
              >
                {book.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Market Stats */}
        <View style={styles.marketStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Spread</Text>
            <Text style={styles.statValue}>{calculateSpread()}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Buy Orders</Text>
            <Text style={styles.statValue}>{buyOrders.length}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sell Orders</Text>
            <Text style={styles.statValue}>{sellOrders.length}</Text>
          </View>
        </View>

        {/* Match Orders Button */}
        {wallet && (
          <TouchableOpacity
            style={styles.matchButton}
            onPress={handleMatchOrders}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.matchButtonText}>Match Orders</Text>
                <Text style={styles.matchButtonSubtext}>
                  Execute crossing orders and earn fees
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'orderbook' && styles.tabActive]}
            onPress={() => setActiveTab('orderbook')}
          >
            <Text style={[styles.tabText, activeTab === 'orderbook' && styles.tabTextActive]}>
              Order Book
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'myorders' && styles.tabActive]}
            onPress={() => setActiveTab('myorders')}
          >
            <Text style={[styles.tabText, activeTab === 'myorders' && styles.tabTextActive]}>
              My Orders ({userOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : activeTab === 'orderbook' ? (
          <View style={styles.orderBookContainer}>
            {/* Sell Orders (reversed) */}
            <View style={styles.orderSection}>
              <View style={styles.orderHeader}>
                <Text style={styles.headerText}>Price</Text>
                <Text style={styles.headerText}>Amount</Text>
                <Text style={styles.headerText}>Total</Text>
              </View>
              
              <View style={styles.sellOrdersContainer}>
                {sellOrders.slice().reverse().map((order, index) => (
                  <View key={order.id.toString()}>
                    {renderOrderItem({ item: order, type: 'sell' })}
                  </View>
                ))}
                {sellOrders.length === 0 && (
                  <Text style={styles.emptyText}>No sell orders</Text>
                )}
              </View>
            </View>

            {/* Spread Indicator */}
            <View style={styles.spreadIndicator}>
              <Text style={styles.spreadText}>Spread: {calculateSpread()}</Text>
            </View>

            {/* Buy Orders */}
            <View style={styles.orderSection}>
              {buyOrders.map((order, index) => (
                <View key={order.id.toString()}>
                  {renderOrderItem({ item: order, type: 'buy' })}
                </View>
              ))}
              {buyOrders.length === 0 && (
                <Text style={styles.emptyText}>No buy orders</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.userOrdersContainer}>
            {userOrders.length > 0 ? (
              userOrders.map((order) => (
                <View key={order.id.toString()}>
                  {renderUserOrder({ item: order })}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>You have no orders in this market</Text>
            )}
          </View>
        )}
      </ScrollView>
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
  marketSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  marketButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  marketButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundTertiary,
  },
  marketButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  marketButtonTextActive: {
    color: COLORS.primary,
  },
  marketStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  matchButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  matchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  matchButtonSubtext: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
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
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  orderBookContainer: {
    padding: 16,
  },
  orderSection: {
    marginBottom: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  headerText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  orderItem: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  buyOrder: {
    backgroundColor: COLORS.success + '10',
  },
  sellOrder: {
    backgroundColor: COLORS.error + '10',
  },
  orderPrice: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  orderAmount: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  orderTotal: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sellOrdersContainer: {
    marginBottom: 8,
  },
  spreadIndicator: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    marginVertical: 8,
    borderRadius: 4,
  },
  spreadText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  userOrdersContainer: {
    padding: 16,
  },
  userOrderItem: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  userOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  buyBadge: {
    backgroundColor: COLORS.success + '20',
  },
  sellBadge: {
    backgroundColor: COLORS.error + '20',
  },
  orderTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  userOrderDetails: {
    marginBottom: 12,
  },
  userOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userOrderLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  userOrderValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  cancelButton: {
    backgroundColor: COLORS.error,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});