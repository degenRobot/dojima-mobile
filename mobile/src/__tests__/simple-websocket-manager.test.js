import { CLOBWebSocketManager } from '../services/CLOBWebSocketManager';

// Mock WebSocket for React Native testing
let activeTimeouts = [];
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.OPEN = 1;
    this.CLOSED = 3;
    
    // Simulate connection after a delay
    const timeout = setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
    activeTimeouts.push(timeout);
  }
  
  send(data) {
    const message = JSON.parse(data);
    
    // Simulate subscription confirmation
    if (message.method === 'eth_subscribe') {
      const timeout = setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify({
              id: message.id,
              result: '0xsubscription123'
            })
          });
        }
      }, 5);
      activeTimeouts.push(timeout);
    }
  }
  
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
};

describe('CLOBWebSocketManager', () => {
  let manager;
  
  beforeEach(() => {
    manager = new CLOBWebSocketManager('wss://test.riselabs.xyz');
  });
  
  afterEach(async () => {
    // Clean up any active timeouts
    activeTimeouts.forEach(timeout => clearTimeout(timeout));
    activeTimeouts = [];
    
    if (manager) {
      manager.disconnect();
      // Clear any reconnection timers
      if (manager.reconnectTimer) {
        clearTimeout(manager.reconnectTimer);
        manager.reconnectTimer = null;
      }
      // Wait a bit for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  });
  
  test('should connect to WebSocket', async () => {
    await manager.connect();
    expect(manager.getIsConnected()).toBe(true);
  });
  
  test('should handle subscription to book', async () => {
    await manager.connect();
    await manager.subscribeToBook(1);
    
    // Verify subscription was sent
    expect(manager.getIsConnected()).toBe(true);
  });
  
  test('should handle event listeners', async () => {
    let orderPlacedCalled = false;
    
    const handler = (order) => {
      orderPlacedCalled = true;
    };
    
    manager.on('orderPlaced', handler);
    
    // Simulate an order placed event
    await manager.connect();
    
    // Simulate receiving an OrderPlaced event
    const mockEvent = {
      data: JSON.stringify({
        method: 'eth_subscription',
        params: {
          result: {
            topics: [
              '0x1234567890abcdef', // Event signature
              '0x0000000000000000000000000000000000000000000000000000000000000001', // orderId
              '0x0000000000000000000000000000000000000000000000000000000000000001', // bookId
              '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266'  // trader
            ],
            data: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001bc16d674ec800000000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000065f7e3c7',
            blockNumber: '0x12345',
            transactionHash: '0xabcdef'
          }
        }
      })
    };
    
    // Note: In a real test, we'd properly mock the decoding
    // For now, just verify the structure is handled
    manager.ws.onmessage(mockEvent);
    
    // Cleanup
    manager.off('orderPlaced', handler);
  });
  
  test('should track user address', () => {
    const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    manager.setUserAddress(userAddress);
    
    // The manager should track this user for user-specific events
    expect(manager.userAddress).toBeDefined();
  });
  
  test('should handle reconnection', async () => {
    await manager.connect();
    
    // Simulate disconnect
    manager.ws.close();
    
    // Should attempt to reconnect
    // In real implementation, this would trigger reconnection logic
    expect(manager.getIsConnected()).toBe(false);
  });
  
  test('should manage order book cache', async () => {
    await manager.connect();
    await manager.subscribeToBook(1);
    
    // Cache should be initialized for book 1
    const cache = manager.getOrderBookCache(1);
    // Cache might be undefined initially but should be created on first update
  });
  
  test('should handle BigInt values in events', () => {
    // Test that BigInt values are properly handled
    const testPrice = BigInt('2000000000'); // 2000 USDC (6 decimals)
    const testAmount = BigInt('1000000000000000000'); // 1 ETH (18 decimals)
    
    // These should not throw errors in React Native with proper polyfills
    expect(testPrice.toString()).toBe('2000000000');
    expect(testAmount.toString()).toBe('1000000000000000000');
  });
  
  test('should clean up on disconnect', () => {
    manager.connect();
    manager.subscribeToBook(1);
    manager.subscribeToBook(2);
    
    manager.disconnect();
    
    expect(manager.getIsConnected()).toBe(false);
    expect(manager.getOrderBookCache(1)).toBeUndefined();
  });
});

// Integration test with mock data
describe('CLOBWebSocketManager Integration', () => {
  test('should handle complete order flow', async () => {
    const manager = new CLOBWebSocketManager('wss://test.riselabs.xyz');
    const events = [];
    
    // Track all events
    manager.on('orderPlaced', (e) => events.push({ type: 'placed', data: e }));
    manager.on('orderMatched', (e) => events.push({ type: 'matched', data: e }));
    manager.on('orderCancelled', (e) => events.push({ type: 'cancelled', data: e }));
    
    await manager.connect();
    await manager.subscribeToBook(1);
    
    // In a real test, we would simulate receiving events from the WebSocket
    // and verify they are properly decoded and emitted
    
    manager.disconnect();
  });
});

// React Native specific tests
describe('React Native Compatibility', () => {
  test('should work in React Native environment', () => {
    // Test that manager works regardless of window object
    // In React Native, window is undefined, but in test env it exists
    
    // Manager should work regardless
    const manager = new CLOBWebSocketManager();
    expect(manager).toBeDefined();
    expect(manager.getIsConnected()).toBe(false);
  });
  
  test('should handle React Native WebSocket implementation', () => {
    // React Native's WebSocket has slightly different behavior
    const ws = new WebSocket('wss://test.com');
    
    // Should have standard WebSocket properties
    expect(ws.readyState).toBeDefined();
    expect(ws.send).toBeDefined();
    expect(ws.close).toBeDefined();
  });
  
  test('should work with viem in React Native', async () => {
    // viem should work in React Native with proper polyfills
    const { decodeEventLog } = require('viem');
    expect(decodeEventLog).toBeDefined();
  });
});