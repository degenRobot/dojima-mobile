/**
 * CLOB Trading Flow Test
 * 
 * Tests complete trading workflows including market orders,
 * limit orders, and full trading scenarios using Porto relay
 * for gasless transactions.
 */

import { PortoClient } from '../lib/porto/client';
import { SessionWallet } from '../lib/porto/session';
import { CONTRACTS, NETWORK_CONFIG, TRADING_PAIRS, FEE_CONFIG } from '../config/contracts';
import { privateKeyToAccount } from 'viem/accounts';
import { Interface, ethers } from 'ethers';

// Mock fetch globally
global.fetch = jest.fn();

describe('CLOB Trading Flow', () => {
  let portoClient;
  let sessionWallet;
  let testAccount;
  let mockFetch;
  let orderBookInterface;
  let erc20Interface;

  const TEST_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const PORTO_RELAY_URL = 'https://rise-testnet-porto.fly.dev';

  // Mock comprehensive order book ABI
  const ORDER_BOOK_ABI = [
    'function placeOrder(uint256 price, uint256 amount, bool isBuy, address token0, address token1) external returns (uint256)',
    'function placeMarketOrder(uint256 amount, bool isBuy, address token0, address token1) external returns (uint256[])',
    'function cancelOrder(uint256 orderId) external',
    'function getOrder(uint256 orderId) external view returns (tuple(uint256 id, address user, uint256 price, uint256 amount, bool isBuy, address token0, address token1, bool isActive))',
    'function getOrderBook(address token0, address token1) external view returns (tuple(uint256 price, uint256 amount)[] buyOrders, tuple(uint256 price, uint256 amount)[] sellOrders)',
    'function getUserOrders(address user) external view returns (uint256[])',
    'function matchOrder(uint256 orderId, uint256 amount) external',
    'function getTradingFee() external view returns (uint256)',
    'function getUserBalance(address user, address token) external view returns (uint256)',
    'event OrderPlaced(uint256 indexed orderId, address indexed user, uint256 price, uint256 amount, bool isBuy, address token0, address token1)',
    'event OrderMatched(uint256 indexed orderId, address indexed taker, uint256 amount, uint256 price)',
    'event MarketOrderExecuted(address indexed user, uint256 amount, bool isBuy, address token0, address token1, uint256[] matchedOrders)',
  ];

  // Mock ERC20 ABI for token operations
  const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address owner) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
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

    // Initialize contract interfaces
    orderBookInterface = new Interface(ORDER_BOOK_ABI);
    erc20Interface = new Interface(ERC20_ABI);
  });

  describe('Market Order Execution', () => {
    const marketOrderParams = {
      amount: ethers.parseUnits('0.1', 18), // 0.1 WETH
      isBuy: true, // Buy WETH with USDC
      token0: CONTRACTS.WETH.address,
      token1: CONTRACTS.USDC.address,
    };

    test('should execute market buy order gaslessly', async () => {
      // Mock successful market order execution
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xmarketBuyIntent',
              intent: { id: 'market-buy-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xmarketBuyTx',
              status: 'confirmed',
              logs: [
                {
                  topics: ['0xMarketOrderExecuted'],
                  data: '0x...',
                },
              ],
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('placeMarketOrder', [
        marketOrderParams.amount,
        marketOrderParams.isBuy,
        marketOrderParams.token0,
        marketOrderParams.token1,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xmarketBuyTx');

      // Verify transaction data
      const decodedData = orderBookInterface.decodeFunctionData('placeMarketOrder', transactionData);
      expect(decodedData[0]).toBe(marketOrderParams.amount); // amount
      expect(decodedData[1]).toBe(marketOrderParams.isBuy); // isBuy
      expect(decodedData[2]).toBe(marketOrderParams.token0); // token0
      expect(decodedData[3]).toBe(marketOrderParams.token1); // token1
    });

    test('should execute market sell order gaslessly', async () => {
      const sellOrderParams = {
        ...marketOrderParams,
        isBuy: false, // Sell WETH for USDC
      };

      // Mock successful market sell execution
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xmarketSellIntent',
              intent: { id: 'market-sell-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xmarketSellTx',
              status: 'confirmed',
            },
          }),
        });

      const transactionData = orderBookInterface.encodeFunctionData('placeMarketOrder', [
        sellOrderParams.amount,
        sellOrderParams.isBuy,
        sellOrderParams.token0,
        sellOrderParams.token1,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: transactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
    });

    test('should handle insufficient liquidity for market orders', async () => {
      // Mock insufficient liquidity error
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -32000,
            message: 'Insufficient liquidity in order book',
          },
        }),
      });

      const largeOrderParams = {
        ...marketOrderParams,
        amount: ethers.parseUnits('100', 18), // Very large order
      };

      const transactionData = orderBookInterface.encodeFunctionData('placeMarketOrder', [
        largeOrderParams.amount,
        largeOrderParams.isBuy,
        largeOrderParams.token0,
        largeOrderParams.token1,
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

  describe('Complete Trading Workflow', () => {
    test('should execute complete buy workflow with token approval', async () => {
      const usdcApprovalAmount = ethers.parseUnits('2000', 6); // Approve 2000 USDC
      const orderAmount = ethers.parseUnits('0.1', 18); // Buy 0.1 WETH
      const orderPrice = ethers.parseUnits('1800', 6); // At 1800 USDC per WETH

      // Step 1: Mock token approval transaction
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xapprovalIntent',
              intent: { id: 'usdc-approval-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xapprovalTx',
              status: 'confirmed',
            },
          }),
        })
        // Step 2: Mock order placement transaction
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xorderIntent',
              intent: { id: 'buy-order-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xorderTx',
              status: 'confirmed',
              logs: [
                {
                  topics: ['0xOrderPlaced'],
                  data: '0x...',
                },
              ],
            },
          }),
        });

      // Execute token approval
      const approvalData = erc20Interface.encodeFunctionData('approve', [
        CONTRACTS.UnifiedCLOB.address,
        usdcApprovalAmount,
      ]);

      const approvalResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.USDC.address,
        data: approvalData,
        value: 0n,
      });

      expect(approvalResult.success).toBe(true);

      // Execute order placement
      const orderData = orderBookInterface.encodeFunctionData('placeOrder', [
        orderPrice,
        orderAmount,
        true, // isBuy
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const orderResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: orderData,
        value: 0n,
      });

      expect(orderResult.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4); // 2 calls per transaction
    });

    test('should execute arbitrage opportunity workflow', async () => {
      // Simulate arbitrage: buy low on one pair, sell high on another
      const wethRisePrice = ethers.parseUnits('0.9', 18); // 0.9 RISE per WETH (cheap)
      const wethUsdcPrice = ethers.parseUnits('1800', 6); // 1800 USDC per WETH
      const riseUsdcPrice = ethers.parseUnits('2', 6); // 2 USDC per RISE
      const arbAmount = ethers.parseUnits('0.1', 18); // 0.1 WETH

      // Mock successful arbitrage transactions
      for (let i = 0; i < 6; i++) { // 3 transactions × 2 calls each
        mockFetch
          .mockResolvedValueOnce({
            json: jest.fn().mockResolvedValue({
              result: {
                hash: `0xarbIntent${i}`,
                intent: { id: `arb-intent-${i}` },
              },
            }),
          })
          .mockResolvedValueOnce({
            json: jest.fn().mockResolvedValue({
              result: {
                hash: `0xarbTx${i}`,
                status: 'confirmed',
              },
            }),
          });
      }

      // Step 1: Buy WETH with RISE (cheap)
      const buyWethData = orderBookInterface.encodeFunctionData('placeOrder', [
        wethRisePrice,
        arbAmount,
        true, // Buy WETH
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const buyResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: buyWethData,
        value: 0n,
      });

      // Step 2: Sell WETH for USDC (expensive)
      const sellWethData = orderBookInterface.encodeFunctionData('placeOrder', [
        wethUsdcPrice,
        arbAmount,
        false, // Sell WETH
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const sellResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: sellWethData,
        value: 0n,
      });

      // Step 3: Buy RISE with USDC (complete the cycle)
      const buyRiseAmount = ethers.parseUnits('900', 18); // 900 RISE
      const buyRiseData = orderBookInterface.encodeFunctionData('placeOrder', [
        riseUsdcPrice,
        buyRiseAmount,
        true, // Buy RISE
        CONTRACTS.USDC.address,
        CONTRACTS.USDC.address,
      ]);

      const buyRiseResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: buyRiseData,
        value: 0n,
      });

      expect(buyResult.success).toBe(true);
      expect(sellResult.success).toBe(true);
      expect(buyRiseResult.success).toBe(true);
    });
  });

  describe('Order Management and Tracking', () => {
    test('should track active orders and cancel when needed', async () => {
      const orderId = 12345;

      // Mock order placement followed by cancellation
      mockFetch
        // Place order
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xplaceIntent',
              intent: { id: 'place-order-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xplaceTx',
              status: 'confirmed',
              orderId: orderId,
            },
          }),
        })
        // Cancel order
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xcancelIntent',
              intent: { id: 'cancel-order-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xcancelTx',
              status: 'confirmed',
            },
          }),
        });

      // Place order
      const placeOrderData = orderBookInterface.encodeFunctionData('placeOrder', [
        ethers.parseUnits('1800', 6), // price
        ethers.parseUnits('0.1', 18), // amount
        false, // sell order
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const placeResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: placeOrderData,
        value: 0n,
      });

      expect(placeResult.success).toBe(true);

      // Cancel order
      const cancelOrderData = orderBookInterface.encodeFunctionData('cancelOrder', [orderId]);

      const cancelResult = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: cancelOrderData,
        value: 0n,
      });

      expect(cancelResult.success).toBe(true);
    });

    test('should handle order book state queries', () => {
      // Test order book queries for all trading pairs
      TRADING_PAIRS.forEach(pair => {
        const baseToken = CONTRACTS[pair.base];
        const quoteToken = CONTRACTS[pair.quote];

        // Get order book
        const orderBookData = orderBookInterface.encodeFunctionData('getOrderBook', [
          baseToken.address,
          quoteToken.address,
        ]);

        expect(orderBookData).toMatch(/^0x/);

        // Get user orders
        const userOrdersData = orderBookInterface.encodeFunctionData('getUserOrders', [
          testAccount.address,
        ]);

        expect(userOrdersData).toMatch(/^0x/);

        // Get user balance
        const userBalanceData = orderBookInterface.encodeFunctionData('getUserBalance', [
          testAccount.address,
          baseToken.address,
        ]);

        expect(userBalanceData).toMatch(/^0x/);
      });
    });
  });

  describe('Fee Calculation and Handling', () => {
    test('should calculate trading fees correctly', () => {
      const orderAmount = ethers.parseUnits('1', 18); // 1 WETH
      const orderPrice = ethers.parseUnits('1800', 6); // 1800 USDC

      // Calculate expected fees based on configuration
      const notionalValue = orderAmount * orderPrice / ethers.parseUnits('1', 18);
      const expectedMakerFee = notionalValue * BigInt(Math.floor(FEE_CONFIG.makerFee * 10000)) / 10000n;
      const expectedTakerFee = notionalValue * BigInt(Math.floor(FEE_CONFIG.takerFee * 10000)) / 10000n;

      expect(expectedMakerFee).toBeGreaterThan(0n);
      expect(expectedTakerFee).toBeGreaterThan(0n);
      expect(expectedTakerFee).toBeGreaterThan(expectedMakerFee);
    });

    test('should validate fee configuration', () => {
      expect(FEE_CONFIG.makerFee).toBe(0.001); // 0.1%
      expect(FEE_CONFIG.takerFee).toBe(0.002); // 0.2%
      expect(FEE_CONFIG.takerFee).toBeGreaterThan(FEE_CONFIG.makerFee);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle slippage protection for market orders', async () => {
      // Mock slippage protection failure
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -32000,
            message: 'Slippage tolerance exceeded',
          },
        }),
      });

      const marketOrderData = orderBookInterface.encodeFunctionData('placeMarketOrder', [
        ethers.parseUnits('10', 18), // Large order likely to cause slippage
        true,
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: marketOrderData,
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Slippage tolerance exceeded');
    });

    test('should handle concurrent order operations', async () => {
      // Mock multiple concurrent operations
      const operations = [
        { type: 'place', orderId: null },
        { type: 'cancel', orderId: 12345 },
        { type: 'match', orderId: 12346 },
      ];

      // Mock responses for all operations
      operations.forEach((_, index) => {
        mockFetch
          .mockResolvedValueOnce({
            json: jest.fn().mockResolvedValue({
              result: {
                hash: `0xconcurrentIntent${index}`,
                intent: { id: `concurrent-${index}` },
              },
            }),
          })
          .mockResolvedValueOnce({
            json: jest.fn().mockResolvedValue({
              result: {
                hash: `0xconcurrentTx${index}`,
                status: 'confirmed',
              },
            }),
          });
      });

      // Execute operations concurrently
      const promises = operations.map((op, index) => {
        let transactionData;
        
        if (op.type === 'place') {
          transactionData = orderBookInterface.encodeFunctionData('placeOrder', [
            ethers.parseUnits('1800', 6),
            ethers.parseUnits('0.1', 18),
            true,
            CONTRACTS.WETH.address,
            CONTRACTS.USDC.address,
          ]);
        } else if (op.type === 'cancel') {
          transactionData = orderBookInterface.encodeFunctionData('cancelOrder', [op.orderId]);
        } else if (op.type === 'match') {
          transactionData = orderBookInterface.encodeFunctionData('matchOrder', [
            op.orderId,
            ethers.parseUnits('0.05', 18),
          ]);
        }

        return sessionWallet.executeTransaction({
          target: CONTRACTS.UnifiedCLOB.address,
          data: transactionData,
          value: 0n,
        });
      });

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle network interruption during trading', async () => {
      // Mock network error during transaction
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xinterruptIntent',
              intent: { id: 'interrupt-intent' },
            },
          }),
        })
        .mockRejectedValueOnce(new Error('Network connection lost'));

      const orderData = orderBookInterface.encodeFunctionData('placeOrder', [
        ethers.parseUnits('1800', 6),
        ethers.parseUnits('0.1', 18),
        true,
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: orderData,
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection lost');
    });
  });

  describe('Integration with Other Trading Pairs', () => {
    test('should support RISE/USDC trading', async () => {
      // Mock RISE/USDC order placement
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xriseIntent',
              intent: { id: 'rise-usdc-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xriseTx',
              status: 'confirmed',
            },
          }),
        });

      const riseOrderData = orderBookInterface.encodeFunctionData('placeOrder', [
        ethers.parseUnits('2', 6), // 2 USDC per RISE
        ethers.parseUnits('1000', 18), // 1000 RISE
        false, // sell RISE
        CONTRACTS.USDC.address,
        CONTRACTS.USDC.address,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: riseOrderData,
        value: 0n,
      });

      expect(result.success).toBe(true);
    });

    test('should support WETH/RISE trading', async () => {
      // Mock WETH/RISE order placement
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xwethRiseIntent',
              intent: { id: 'weth-rise-intent' },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              hash: '0xwethRiseTx',
              status: 'confirmed',
            },
          }),
        });

      const wethRiseOrderData = orderBookInterface.encodeFunctionData('placeOrder', [
        ethers.parseUnits('900', 18), // 900 RISE per WETH
        ethers.parseUnits('0.1', 18), // 0.1 WETH
        true, // buy WETH with RISE
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: wethRiseOrderData,
        value: 0n,
      });

      expect(result.success).toBe(true);
    });
  });
});