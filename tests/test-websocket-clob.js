import WebSocket from 'ws';
import { createPublicClient, decodeEventLog, parseAbi } from 'viem';
import { rise } from '../mobile/src/lib/chains';
import { unifiedCLOBV2ABI } from '../indexing/abis/UnifiedCLOBV2.js';

const RISE_WS_URL = 'wss://ws.testnet.riselabs.xyz';
const UNIFIED_CLOB_ADDRESS = '0x92025983Ab5641378893C3932A1a43e214e7446D';

// Event signatures
const EVENT_TOPICS = {
  OrderPlaced: '0x9f1918e8d4a0c8e3c6c0e8e3c6c0e8e3c6c0e8e3c6c0e8e3c6c0e8e3c6c0e8e3',
  OrderMatched: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  OrderCancelled: '0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  PriceUpdate: '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  VolumeUpdate: '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
  Deposited: '0xe5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
  Withdrawn: '0xf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'
};

class CLOBWebSocketClient {
  constructor() {
    this.ws = null;
    this.subscriptionId = null;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to RISE WebSocket...');
      
      this.ws = new WebSocket(RISE_WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket disconnected');
        this.handleReconnect();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle subscription confirmation
      if (message.id === 1 && message.result) {
        this.subscriptionId = message.result;
        console.log('✅ Subscription confirmed:', this.subscriptionId);
        return;
      }
      
      // Handle event notifications
      if (message.method === 'eth_subscription' && message.params) {
        const { result } = message.params;
        
        if (result && result.topics && result.data) {
          this.decodeAndEmitEvent(result);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  decodeAndEmitEvent(log) {
    try {
      // Decode the event log
      const decodedEvent = decodeEventLog({
        abi: unifiedCLOBV2ABI,
        data: log.data,
        topics: log.topics,
      });
      
      const timestamp = new Date().toISOString();
      console.log(`\n📢 [${timestamp}] Event: ${decodedEvent.eventName}`);
      console.log('   Data:', decodedEvent.args);
      console.log('   Block:', parseInt(log.blockNumber, 16));
      console.log('   Tx:', log.transactionHash);
      
      // Emit to specific handlers
      const handlers = this.eventHandlers.get(decodedEvent.eventName);
      if (handlers) {
        handlers.forEach(handler => handler(decodedEvent));
      }
    } catch (error) {
      // Not a CLOB event or decoding failed
      // Silent fail as we might receive other events
    }
  }

  async subscribeToCLOBEvents() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const subscribeMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: [
        'logs',
        {
          address: UNIFIED_CLOB_ADDRESS,
          topics: [] // Subscribe to all events from this contract
        }
      ]
    };
    
    console.log('📡 Subscribing to CLOB events...');
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  async subscribeToOrderBook(bookId) {
    // In a real implementation, we would filter by bookId
    console.log(`📚 Subscribing to order book ${bookId}...`);
    await this.subscribeToCLOBEvents();
  }

  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName).add(handler);
  }

  off(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        if (this.subscriptionId) {
          await this.subscribeToCLOBEvents();
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Test the WebSocket client
const testWebSocket = async () => {
  console.log('🚀 Testing CLOB WebSocket Integration\n');
  
  const client = new CLOBWebSocketClient();
  
  // Register event handlers
  client.on('OrderPlaced', (event) => {
    console.log('🆕 New Order Placed!');
    console.log('   Order ID:', event.args.orderId?.toString());
    console.log('   Book ID:', event.args.bookId?.toString());
    console.log('   Type:', event.args.orderType === 0n ? 'BUY' : 'SELL');
    console.log('   Price:', event.args.price?.toString());
    console.log('   Amount:', event.args.amount?.toString());
  });
  
  client.on('OrderMatched', (event) => {
    console.log('🤝 Orders Matched!');
    console.log('   Buy Order:', event.args.buyOrderId?.toString());
    console.log('   Sell Order:', event.args.sellOrderId?.toString());
    console.log('   Price:', event.args.price?.toString());
    console.log('   Amount:', event.args.amount?.toString());
  });
  
  client.on('OrderCancelled', (event) => {
    console.log('❌ Order Cancelled!');
    console.log('   Order ID:', event.args.orderId?.toString());
  });
  
  client.on('PriceUpdate', (event) => {
    console.log('📊 Price Update!');
    console.log('   Book ID:', event.args.bookId?.toString());
    console.log('   New Price:', event.args.price?.toString());
  });
  
  client.on('Deposited', (event) => {
    console.log('💰 Deposit Made!');
    console.log('   User:', event.args.user);
    console.log('   Token:', event.args.token);
    console.log('   Amount:', event.args.amount?.toString());
  });
  
  client.on('Withdrawn', (event) => {
    console.log('💸 Withdrawal Made!');
    console.log('   User:', event.args.user);
    console.log('   Token:', event.args.token);
    console.log('   Amount:', event.args.amount?.toString());
  });
  
  try {
    // Connect and subscribe
    await client.connect();
    await client.subscribeToCLOBEvents();
    
    console.log('\n👂 Listening for CLOB events...');
    console.log('   Contract:', UNIFIED_CLOB_ADDRESS);
    console.log('   Network: RISE Testnet\n');
    console.log('Try placing orders, matching, or cancelling from another terminal!\n');
    console.log('Press Ctrl+C to stop.\n');
    
    // Keep the script running
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down...');
      client.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

// Run the test
testWebSocket();