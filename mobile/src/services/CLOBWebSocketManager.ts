import { decodeEventLog } from 'viem';
import { CONTRACTS } from '../config/contracts';
import { unifiedCLOBV2ABI } from '../constants/unifiedCLOBV2ABI';

interface OrderBookUpdate {
  bookId: number;
  type: 'ORDER_PLACED' | 'ORDER_MATCHED' | 'ORDER_CANCELLED';
  data: any;
}

interface PriceUpdate {
  bookId: number;
  price: bigint;
  timestamp: number;
}

interface VolumeUpdate {
  bookId: number;
  volume: bigint;
  timestamp: number;
}

interface CLOBEventHandlers {
  onOrderBookUpdate?: (update: OrderBookUpdate) => void;
  onPriceUpdate?: (update: PriceUpdate) => void;
  onVolumeUpdate?: (update: VolumeUpdate) => void;
  onTradeExecuted?: (trade: any) => void;
  onUserOrderUpdate?: (order: any) => void;
}

export class CLOBWebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptionId: string | null = null;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private orderBookCache: Map<number, any> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  reconnectTimer: NodeJS.Timeout | null = null;
  private subscribedBooks: Set<number> = new Set();
  private userAddress: string | null = null;

  constructor(private wsUrl: string = 'wss://ws.testnet.riselabs.xyz') {}

  // Connection management
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[CLOB WS] Connecting to WebSocket...');
      
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('[CLOB WS] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Resubscribe to previously subscribed books
        this.resubscribeToBooks();
        
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('[CLOB WS] Error:', error);
        this.emit('error', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('[CLOB WS] Disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        this.handleReconnect();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      
      // Handle subscription confirmation
      if (message.id && message.result) {
        this.subscriptionId = message.result;
        console.log('[CLOB WS] Subscription confirmed:', this.subscriptionId);
        return;
      }
      
      // Handle event notifications
      if (message.method === 'eth_subscription' && message.params) {
        const { result } = message.params;
        
        if (result && result.topics && result.data) {
          this.decodeAndHandleEvent(result);
        }
      }
    } catch (error) {
      console.error('[CLOB WS] Error handling message:', error);
    }
  }

  private decodeAndHandleEvent(log: any) {
    try {
      // Decode the event log
      const decodedEvent = decodeEventLog({
        abi: unifiedCLOBV2ABI,
        data: log.data,
        topics: log.topics,
      });
      
      // Handle different event types
      switch (decodedEvent.eventName) {
        case 'OrderPlaced':
          this.handleOrderPlaced(decodedEvent.args);
          break;
        case 'OrderMatched':
          this.handleOrderMatched(decodedEvent.args);
          break;
        case 'OrderCancelled':
          this.handleOrderCancelled(decodedEvent.args);
          break;
        case 'PriceUpdate':
          this.handlePriceUpdate(decodedEvent.args);
          break;
        case 'VolumeUpdate':
          this.handleVolumeUpdate(decodedEvent.args);
          break;
        case 'Deposited':
          this.handleDeposited(decodedEvent.args);
          break;
        case 'Withdrawn':
          this.handleWithdrawn(decodedEvent.args);
          break;
        default:
          console.log('[CLOB WS] Unknown event:', decodedEvent.eventName);
      }
      
      // Emit raw event for debugging/logging
      this.emit('rawEvent', { 
        eventName: decodedEvent.eventName, 
        args: decodedEvent.args,
        blockNumber: parseInt(log.blockNumber, 16),
        transactionHash: log.transactionHash
      });
      
    } catch (error) {
      // Not a CLOB event or decoding failed - silent fail
    }
  }

  // Event handlers
  private handleOrderPlaced(args: any) {
    const bookId = Number(args.bookId);
    const order = {
      id: args.orderId?.toString(),
      trader: args.trader,
      bookId,
      orderType: args.orderType === 0n ? 'BUY' : 'SELL',
      price: args.price,
      amount: args.amount,
      timestamp: Number(args.timestamp)
    };
    
    // Update cache
    this.updateOrderBookCache(bookId, 'ORDER_PLACED', order);
    
    // Emit events
    this.emit('orderPlaced', order);
    this.emit('orderBookUpdate', {
      bookId,
      type: 'ORDER_PLACED',
      data: order
    });
    
    // Emit user-specific event if it's the tracked user
    if (this.userAddress && args.trader.toLowerCase() === this.userAddress.toLowerCase()) {
      this.emit('userOrderUpdate', { ...order, status: 'PLACED' });
    }
  }

  private handleOrderMatched(args: any) {
    const bookId = Number(args.bookId);
    const trade = {
      buyOrderId: args.buyOrderId?.toString(),
      sellOrderId: args.sellOrderId?.toString(),
      bookId,
      buyer: args.buyer,
      seller: args.seller,
      price: args.price,
      amount: args.amount,
      buyerFee: args.buyerFee,
      sellerFee: args.sellerFee,
      timestamp: Number(args.timestamp)
    };
    
    // Update cache
    this.updateOrderBookCache(bookId, 'ORDER_MATCHED', trade);
    
    // Emit events
    this.emit('orderMatched', trade);
    this.emit('orderBookUpdate', {
      bookId,
      type: 'ORDER_MATCHED',
      data: trade
    });
    this.emit('tradeExecuted', trade);
    
    // Emit user-specific events
    if (this.userAddress) {
      const userAddr = this.userAddress.toLowerCase();
      if (args.buyer.toLowerCase() === userAddr) {
        this.emit('userOrderUpdate', { 
          orderId: trade.buyOrderId, 
          status: 'MATCHED',
          trade 
        });
      }
      if (args.seller.toLowerCase() === userAddr) {
        this.emit('userOrderUpdate', { 
          orderId: trade.sellOrderId, 
          status: 'MATCHED',
          trade 
        });
      }
    }
  }

  private handleOrderCancelled(args: any) {
    const order = {
      id: args.orderId?.toString(),
      trader: args.trader,
      timestamp: Number(args.timestamp)
    };
    
    // Find bookId from cache (would need to track this)
    const bookId = this.findBookIdForOrder(order.id);
    
    if (bookId !== null) {
      this.updateOrderBookCache(bookId, 'ORDER_CANCELLED', order);
      
      this.emit('orderCancelled', order);
      this.emit('orderBookUpdate', {
        bookId,
        type: 'ORDER_CANCELLED',
        data: order
      });
    }
    
    // Emit user-specific event
    if (this.userAddress && args.trader.toLowerCase() === this.userAddress.toLowerCase()) {
      this.emit('userOrderUpdate', { ...order, status: 'CANCELLED' });
    }
  }

  private handlePriceUpdate(args: any) {
    const update: PriceUpdate = {
      bookId: Number(args.bookId),
      price: args.price,
      timestamp: Number(args.timestamp)
    };
    
    this.emit('priceUpdate', update);
  }

  private handleVolumeUpdate(args: any) {
    const update: VolumeUpdate = {
      bookId: Number(args.bookId),
      volume: args.volume,
      timestamp: Number(args.timestamp)
    };
    
    this.emit('volumeUpdate', update);
  }

  private handleDeposited(args: any) {
    const deposit = {
      user: args.user,
      token: args.token,
      amount: args.amount
    };
    
    this.emit('deposited', deposit);
    
    // Emit user-specific event
    if (this.userAddress && args.user.toLowerCase() === this.userAddress.toLowerCase()) {
      this.emit('userBalanceUpdate', { type: 'DEPOSIT', ...deposit });
    }
  }

  private handleWithdrawn(args: any) {
    const withdrawal = {
      user: args.user,
      token: args.token,
      amount: args.amount
    };
    
    this.emit('withdrawn', withdrawal);
    
    // Emit user-specific event
    if (this.userAddress && args.user.toLowerCase() === this.userAddress.toLowerCase()) {
      this.emit('userBalanceUpdate', { type: 'WITHDRAWAL', ...withdrawal });
    }
  }

  // Order book cache management
  private updateOrderBookCache(bookId: number, type: string, data: any) {
    const cache = this.orderBookCache.get(bookId) || { 
      buyOrders: [], 
      sellOrders: [],
      lastUpdate: Date.now()
    };
    
    // Update cache based on event type
    // This is simplified - real implementation would need more sophisticated logic
    cache.lastUpdate = Date.now();
    this.orderBookCache.set(bookId, cache);
  }

  private findBookIdForOrder(orderId: string): number | null {
    // In a real implementation, we'd track order->book mapping
    // For now, return null
    return null;
  }

  // Subscription management
  async subscribeToBook(bookId: number) {
    this.subscribedBooks.add(bookId);
    
    if (!this.isConnected || !this.ws) {
      console.log('[CLOB WS] Not connected, will subscribe when connected');
      return;
    }
    
    // Subscribe to all CLOB events (filtered client-side for bookId)
    await this.subscribeToCLOBEvents();
    
    console.log(`[CLOB WS] Subscribed to book ${bookId}`);
  }

  async unsubscribeFromBook(bookId: number) {
    this.subscribedBooks.delete(bookId);
    this.orderBookCache.delete(bookId);
    
    console.log(`[CLOB WS] Unsubscribed from book ${bookId}`);
  }

  private async subscribeToCLOBEvents() {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    const subscribeMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: [
        'logs',
        {
          address: CONTRACTS.UnifiedCLOB.address,
          topics: [] // Subscribe to all events
        }
      ]
    };
    
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  private async resubscribeToBooks() {
    if (this.subscribedBooks.size > 0) {
      console.log('[CLOB WS] Resubscribing to books:', Array.from(this.subscribedBooks));
      await this.subscribeToCLOBEvents();
    }
  }

  // User tracking
  setUserAddress(address: string | null) {
    this.userAddress = address;
    console.log('[CLOB WS] Tracking user:', address);
  }

  // Event emitter pattern
  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[CLOB WS] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Reconnection logic
  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CLOB WS] Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[CLOB WS] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[CLOB WS] Reconnection failed:', error);
      }
    }, delay);
  }

  // Cleanup
  disconnect() {
    // Clear any pending reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      // Remove all event handlers before closing
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscriptionId = null;
    this.subscribedBooks.clear();
    this.orderBookCache.clear();
    this.eventHandlers.clear();
  }

  // Status getters
  getIsConnected(): boolean {
    return this.isConnected;
  }

  getOrderBookCache(bookId: number): any {
    return this.orderBookCache.get(bookId);
  }
}

// Singleton instance
let instance: CLOBWebSocketManager | null = null;

export function getCLOBWebSocketManager(): CLOBWebSocketManager {
  if (!instance) {
    instance = new CLOBWebSocketManager();
  }
  return instance;
}