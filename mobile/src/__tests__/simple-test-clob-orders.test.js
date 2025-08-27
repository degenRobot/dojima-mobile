/**
 * CLOB Order Management Test
 * 
 * Tests order placement, cancellation, and management operations
 * using Porto relay for gasless transactions.
 */

import { PortoClient } from '../lib/porto/client';
import { SessionWallet } from '../lib/porto/session';
import { CONTRACTS, NETWORK_CONFIG, TRADING_PAIRS } from '../config/contracts';
import { privateKeyToAccount } from 'viem/accounts';
import { Interface, ethers } from 'ethers';

// Mock fetch globally
global.fetch = jest.fn();

describe('CLOB Order Management', () => {
  let portoClient;
  let sessionWallet;
  let testAccount;
  let mockFetch;
  let orderBookInterface;

  const TEST_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const PORTO_RELAY_URL = 'https://rise-testnet-porto.fly.dev';

  // Mock order book ABI for testing
  const ORDER_BOOK_ABI = [
    'function placeOrder(uint256 price, uint256 amount, bool isBuy, address token0, address token1) external returns (uint256)',
    'function cancelOrder(uint256 orderId) external',
    'function getOrder(uint256 orderId) external view returns (tuple(uint256 id, address user, uint256 price, uint256 amount, bool isBuy, address token0, address token1, bool isActive))',
    'function getUserOrders(address user) external view returns (uint256[])',
    'function getOrderBook(address token0, address token1) external view returns (tuple(uint256 price, uint256 amount)[] buyOrders, tuple(uint256 price, uint256 amount)[] sellOrders)',
    'function matchOrder(uint256 orderId, uint256 amount) external',
    'event OrderPlaced(uint256 indexed orderId, address indexed user, uint256 price, uint256 amount, bool isBuy, address token0, address token1)',
    'event OrderCancelled(uint256 indexed orderId, address indexed user)',
    'event OrderMatched(uint256 indexed orderId, address indexed taker, uint256 amount, uint256 price)',
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock fetch
    mockFetch = global.fetch;
    
    // Create test account
    testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
    
    // Initialize Porto client
    portoClient = new PortoClient({
      relayUrl: PORTO_RELAY_URL,
      chainId: NETWORK_CONFIG.chainId,
      rpcUrl: NETWORK_CONFIG.rpcUrl,
    });

    // Initialize session wallet
    sessionWallet = new SessionWallet({
      sessionKey: TEST_PRIVATE_KEY,
      account: testAccount,
      portoClient,
    });

    // Initialize order book interface
    orderBookInterface = new Interface(ORDER_BOOK_ABI);
  });

  describe('Order Placement', () => {
    const mockOrderParams = {
      price: ethers.parseUnits('1800', 6), // 1800 USDC (6 decimals)
      amount: ethers.parseUnits('0.1', 18), // 0.1 WETH (18 decimals)
      isBuy: false, // Sell order
      token0: CONTRACTS.WETH.address,
      token1: CONTRACTS.USDC.address,
    };

    test('should place a limit sell order gaslessly', async () => {
      const expectedOrderId = 12345;

      // Mock transaction execution
      mockFetch
        // Mock prepare intent
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xintentHash123',
              intent: {
                id: 'place-order-intent',
                sender: testAccount.address,
              },
            },
          }),
        })
        // Mock submit intent
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xorderTransactionHash',
              status: 'pending',
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('placeOrder', [
        mockOrderParams.price,
        mockOrderParams.amount,
        mockOrderParams.isBuy,
        mockOrderParams.token0,
        mockOrderParams.token1,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xorderTransactionHash');

      // Verify the transaction data contains correct order parameters
      const decodedData = orderBookInterface.decodeFunctionData('placeOrder', transactionData);
      expect(decodedData[0]).toBe(mockOrderParams.price); // price
      expect(decodedData[1]).toBe(mockOrderParams.amount); // amount
      expect(decodedData[2]).toBe(mockOrderParams.isBuy); // isBuy
      expect(decodedData[3]).toBe(mockOrderParams.token0); // token0
      expect(decodedData[4]).toBe(mockOrderParams.token1); // token1
    });

    test('should place a limit buy order gaslessly', async () => {
      const buyOrderParams = {
        ...mockOrderParams,
        price: ethers.parseUnits('1750', 6), // Lower price for buy order
        isBuy: true,
      };

      // Mock successful transaction execution
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xbuyIntentHash',
              intent: { id: 'buy-order-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xbuyTransactionHash',
              status: 'confirmed',
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('placeOrder', [
        buyOrderParams.price,
        buyOrderParams.amount,
        buyOrderParams.isBuy,
        buyOrderParams.token0,
        buyOrderParams.token1,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xbuyTransactionHash');
    });

    test('should handle order placement failures', async () => {
      // Mock insufficient balance error
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -32000,
            message: 'Insufficient token balance',
          },
        }),
      });

      const transactionData = orderBookInterface.encodeFunctionData('placeOrder', [
        mockOrderParams.price,
        mockOrderParams.amount,
        mockOrderParams.isBuy,
        mockOrderParams.token0,
        mockOrderParams.token1,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient token balance');
    });

    test('should validate order parameters', () => {
      // Test price validation
      expect(() => {
        orderBookInterface.encodeFunctionData('placeOrder', [
          0, // Invalid zero price
          mockOrderParams.amount,
          mockOrderParams.isBuy,
          mockOrderParams.token0,
          mockOrderParams.token1,
        ]);
      }).not.toThrow(); // Contract should handle validation

      // Test amount validation
      expect(() => {
        orderBookInterface.encodeFunctionData('placeOrder', [
          mockOrderParams.price,
          0, // Invalid zero amount
          mockOrderParams.isBuy,
          mockOrderParams.token0,
          mockOrderParams.token1,
        ]);
      }).not.toThrow(); // Contract should handle validation
    });
  });

  describe('Order Cancellation', () => {
    const mockOrderId = 12345;

    test('should cancel an order gaslessly', async () => {
      // Mock successful cancellation
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xcancelIntentHash',
              intent: { id: 'cancel-order-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xcancelTransactionHash',
              status: 'confirmed',
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('cancelOrder', [mockOrderId]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xcancelTransactionHash');

      // Verify the transaction data contains correct order ID
      const decodedData = orderBookInterface.decodeFunctionData('cancelOrder', transactionData);
      expect(decodedData[0]).toBe(BigInt(mockOrderId));
    });

    test('should handle order cancellation failures', async () => {
      // Mock order not found error
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -32000,
            message: 'Order not found or already cancelled',
          },
        }),
      });

      const transactionData = orderBookInterface.encodeFunctionData('cancelOrder', [mockOrderId]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
    });

    test('should handle unauthorized cancellation attempts', async () => {
      // Mock unauthorized error
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -32000,
            message: 'Not order owner',
          },
        }),
      });

      const transactionData = orderBookInterface.encodeFunctionData('cancelOrder', [mockOrderId]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not order owner');
    });
  });

  describe('Order Status and Management', () => {
    test('should get order information', async () => {
      // Mock read-only call (would use regular RPC, not Porto)
      const mockOrder = {
        id: 12345,
        user: testAccount.address,
        price: ethers.parseUnits('1800', 6),
        amount: ethers.parseUnits('0.1', 18),
        isBuy: false,
        token0: CONTRACTS.WETH.address,
        token1: CONTRACTS.USDC.address,
        isActive: true,
      };

      // This would typically be a direct RPC call, not through Porto
      const getOrderData = orderBookInterface.encodeFunctionData('getOrder', [12345]);
      expect(getOrderData).toMatch(/^0x/);
      
      // Verify the encoded data is correct
      const decodedData = orderBookInterface.decodeFunctionData('getOrder', getOrderData);
      expect(decodedData[0]).toBe(BigInt(12345));
    });

    test('should get user orders', async () => {
      // Mock getting all user orders
      const getUserOrdersData = orderBookInterface.encodeFunctionData('getUserOrders', [testAccount.address]);
      expect(getUserOrdersData).toMatch(/^0x/);
      
      // Verify the encoded data is correct
      const decodedData = orderBookInterface.decodeFunctionData('getUserOrders', getUserOrdersData);
      expect(decodedData[0].toLowerCase()).toBe(testAccount.address.toLowerCase());
    });

    test('should get order book state', async () => {
      // Mock getting order book for WETH/USDC pair
      const getOrderBookData = orderBookInterface.encodeFunctionData('getOrderBook', [
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);
      expect(getOrderBookData).toMatch(/^0x/);
      
      // Verify the encoded data is correct
      const decodedData = orderBookInterface.decodeFunctionData('getOrderBook', getOrderBookData);
      expect(decodedData[0].toLowerCase()).toBe(CONTRACTS.WETH.address.toLowerCase());
      expect(decodedData[1].toLowerCase()).toBe(CONTRACTS.USDC.address.toLowerCase());
    });
  });

  describe('Order Matching', () => {
    const mockOrderId = 12345;
    const matchAmount = ethers.parseUnits('0.05', 18); // Match half the order

    test('should match order gaslessly', async () => {
      // Mock successful order matching
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xmatchIntentHash',
              intent: { id: 'match-order-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xmatchTransactionHash',
              status: 'confirmed',
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('matchOrder', [
        mockOrderId,
        matchAmount,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xmatchTransactionHash');

      // Verify the transaction data contains correct parameters
      const decodedData = orderBookInterface.decodeFunctionData('matchOrder', transactionData);
      expect(decodedData[0]).toBe(BigInt(mockOrderId)); // orderId
      expect(decodedData[1]).toBe(matchAmount); // amount
    });

    test('should handle partial order matching', async () => {
      const partialAmount = ethers.parseUnits('0.01', 18); // Very small match

      // Mock successful partial matching
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xpartialIntentHash',
              intent: { id: 'partial-match-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xpartialTransactionHash',
              status: 'confirmed',
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('matchOrder', [
        mockOrderId,
        partialAmount,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
    });

    test('should handle order matching failures', async () => {
      // Mock insufficient liquidity error
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -32000,
            message: 'Insufficient liquidity or order not active',
          },
        }),
      });

      const transactionData = orderBookInterface.encodeFunctionData('matchOrder', [
        mockOrderId,
        matchAmount,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient liquidity');
    });
  });

  describe('Trading Pairs and Configuration', () => {
    test('should validate trading pair configurations', () => {
      expect(TRADING_PAIRS).toHaveLength(3);
      
      const wethUsdcPair = TRADING_PAIRS.find(pair => pair.symbol === 'WETH/USDC');
      expect(wethUsdcPair).toBeDefined();
      expect(wethUsdcPair.base).toBe('WETH');
      expect(wethUsdcPair.quote).toBe('USDC');

      const riseUsdcPair = TRADING_PAIRS.find(pair => pair.symbol === 'RISE/USDC');
      expect(riseUsdcPair).toBeDefined();
      expect(riseUsdcPair.base).toBe('RISE');
      expect(riseUsdcPair.quote).toBe('USDC');
    });

    test('should generate order book calls for all trading pairs', () => {
      TRADING_PAIRS.forEach(pair => {
        const baseToken = CONTRACTS[pair.base];
        const quoteToken = CONTRACTS[pair.quote];
        
        expect(baseToken).toBeDefined();
        expect(quoteToken).toBeDefined();
        
        const getOrderBookData = orderBookInterface.encodeFunctionData('getOrderBook', [
          baseToken.address,
          quoteToken.address,
        ]);
        
        expect(getOrderBookData).toMatch(/^0x/);
      });
    });
  });

  describe('Batch Operations', () => {
    test('should handle multiple order operations in sequence', async () => {
      const orders = [
        {
          price: ethers.parseUnits('1800', 6),
          amount: ethers.parseUnits('0.1', 18),
          isBuy: false,
        },
        {
          price: ethers.parseUnits('1750', 6),
          amount: ethers.parseUnits('0.2', 18),
          isBuy: true,
        },
      ];

      // Mock successful transactions for each order
      for (let i = 0; i < orders.length; i++) {
        mockFetch
          .mockResolvedValueOnce({
            json: jest.fn().mockResolvedValue({
              result: {
                hash: `0xbatchIntent${i}`,
                intent: { id: `batch-order-${i}` },
              },
            }),
          })
          .mockResolvedValueOnce({
            json: jest.fn().mockResolvedValue({
              result: {
                hash: `0xbatchTx${i}`,
                status: 'confirmed',
              },
            }),
          });
      }

      // Execute orders sequentially
      const results = [];
      for (const order of orders) {
        const transactionData = orderBookInterface.encodeFunctionData('placeOrder', [
          order.price,
          order.amount,
          order.isBuy,
          CONTRACTS.WETH.address,
          CONTRACTS.USDC.address,
        ]);

        const result = await sessionWallet.executeTransaction({
          target: CONTRACTS.UnifiedCLOB.address,
          data: transactionData,
          value: 0n,
        });

        results.push(result);
      }

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});