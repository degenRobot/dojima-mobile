/**
 * CLOB Gasless Operations Test
 * 
 * Tests Porto relay integration for gasless CLOB trading operations
 * focusing on delegation setup and basic transaction execution.
 */

import { PortoClient } from '../lib/porto/client';
import { SessionWallet } from '../lib/porto/session';
import { CONTRACTS, NETWORK_CONFIG } from '../config/contracts';
import { createWalletClient, http, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Contract, ethers, Interface } from 'ethers';

// Mock fetch globally
global.fetch = jest.fn();

describe('CLOB Gasless Operations', () => {
  let portoClient;
  let sessionWallet;
  let testAccount;
  let mockFetch;

  const TEST_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const PORTO_RELAY_URL = 'https://rise-testnet-porto.fly.dev';

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
  });

  describe('Porto Client Setup', () => {
    test('should initialize Porto client with correct configuration', () => {
      expect(portoClient).toBeDefined();
      expect(portoClient.config).toEqual({
        relayUrl: PORTO_RELAY_URL,
        chainId: NETWORK_CONFIG.chainId,
        rpcUrl: NETWORK_CONFIG.rpcUrl,
      });
    });

    test('should check delegation status', async () => {
      // Mock successful delegation status response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            isDelegated: true,
            isPending: false,
            delegationAddress: '0xc46F88d3bfe039A0aA31E1eC2D4ccB3a4D4112FF',
          },
        }),
      });

      const status = await portoClient.checkDelegationStatus(testAccount.address);

      expect(status.isDelegated).toBe(true);
      expect(status.isPending).toBe(false);
      expect(status.delegationAddress).toBe('0xc46F88d3bfe039A0aA31E1eC2D4ccB3a4D4112FF');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${PORTO_RELAY_URL}/rpc`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    test('should handle delegation status errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const status = await portoClient.checkDelegationStatus(testAccount.address);

      expect(status.isDelegated).toBe(false);
      expect(status.isPending).toBe(false);
      expect(status.delegationAddress).toBeUndefined();
    });
  });

  describe('Delegation Setup', () => {
    test('should setup delegation for CLOB trading', async () => {
      // Mock prepare upgrade response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            context: 'mock-context-id',
            digests: {
              auth: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              exec: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            },
          },
        }),
      });

      // Mock upgrade account response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            success: true,
            delegationHash: '0xupgradehash123',
          },
        }),
      });

      const result = await portoClient.setupDelegation(testAccount.address, testAccount);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify prepare upgrade call
      const prepareCall = mockFetch.mock.calls[0];
      expect(prepareCall[0]).toBe(`${PORTO_RELAY_URL}/rpc`);
      
      const prepareBody = JSON.parse(prepareCall[1].body);
      expect(prepareBody.method).toBe('wallet_prepareUpgradeAccount');
      expect(prepareBody.params[0]).toMatchObject({
        address: testAccount.address,
        delegation: '0xc46F88d3bfe039A0aA31E1eC2D4ccB3a4D4112FF',
        chainId: NETWORK_CONFIG.chainId,
      });
    });

    test('should handle delegation setup errors', async () => {
      // Mock failed prepare upgrade
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -1,
            message: 'Failed to prepare upgrade',
          },
        }),
      });

      const result = await portoClient.setupDelegation(testAccount.address, testAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to prepare upgrade');
    });
  });

  describe('Session Wallet', () => {
    test('should create session wallet with correct configuration', () => {
      expect(sessionWallet.account.address).toBe(testAccount.address);
      expect(sessionWallet.getAddress()).toBe(testAccount.address);
    });

    test('should check session validity', async () => {
      // Mock account info response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            isActive: true,
            isDelegated: true,
          },
        }),
      });

      const isValid = await sessionWallet.isValid();
      expect(isValid).toBe(true);
    });

    test('should refresh session when delegation is missing', async () => {
      // Mock delegation status (not delegated)
      mockFetch
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              isDelegated: false,
              isPending: false,
            },
          }),
        })
        // Mock prepare upgrade response
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              context: 'refresh-context',
              digests: {
                auth: '0xrefreshauth123',
                exec: '0xrefreshexec123',
              },
            },
          }),
        })
        // Mock upgrade account response
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            result: {
              success: true,
            },
          }),
        });

      const refreshResult = await sessionWallet.refresh();
      expect(refreshResult).toBe(true);
    });
  });

  describe('Basic Transaction Execution', () => {
    test('should prepare gasless transaction intent', async () => {
      const mockTransactionData = '0x1234567890abcdef'; // Mock encoded transaction data
      const targetContract = CONTRACTS.UnifiedCLOB.address;

      // Mock prepare intent response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            hash: '0xintentHash123',
            intent: {
              id: 'intent-123',
              sender: testAccount.address,
              calls: [{
                to: targetContract,
                data: mockTransactionData,
                value: '0',
              }],
            },
          },
        }),
      });

      // Mock submit intent response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            hash: '0xtransactionHash123',
            status: 'pending',
          },
        }),
      });

      const result = await sessionWallet.executeTransaction({
        target: targetContract,
        data: mockTransactionData,
        value: 0n,
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xtransactionHash123');
      
      // Verify prepare intent was called
      const prepareCall = mockFetch.mock.calls[0];
      const prepareBody = JSON.parse(prepareCall[1].body);
      expect(prepareBody.method).toBe('wallet_prepareIntent');
      expect(prepareBody.params[0].sender).toBe(testAccount.address);
      expect(prepareBody.params[0].capabilities.calls[0].to).toBe(targetContract);
      expect(prepareBody.params[0].capabilities.calls[0].data).toBe(mockTransactionData);
    });

    test('should handle transaction execution failures', async () => {
      // Mock failed prepare intent
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: -1,
            message: 'Insufficient funds',
          },
        }),
      });

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: '0x1234',
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient funds');
    });
  });

  describe('CLOB Contract Integration', () => {
    test('should have correct CLOB contract addresses', () => {
      expect(CONTRACTS.UnifiedCLOB.address).toBe('0x92025983Ab5641378893C3932A1a43e214e7446D');
      expect(CONTRACTS.WETH.address).toBe('0xb5a1a0eB48a5CE19fD32D96C893A1A3B931C1a83');
      expect(CONTRACTS.USDC.address).toBe('0xC6C7F99020CcECaEa2CEc088E09F1f3D13529DA9');
    });

    test('should prepare CLOB transaction data', () => {
      // Example: Encode a place order function call
      const orderBookInterface = new Interface([
        'function placeOrder(uint256 price, uint256 amount, bool isBuy, address token0, address token1) external returns (uint256)',
      ]);

      const encodedData = orderBookInterface.encodeFunctionData('placeOrder', [
        ethers.parseUnits('1800', 6), // Price: 1800 USDC (6 decimals)
        ethers.parseUnits('0.1', 18), // Amount: 0.1 WETH (18 decimals)
        false, // isBuy = false (sell order)
        CONTRACTS.WETH.address,
        CONTRACTS.USDC.address,
      ]);

      expect(encodedData).toMatch(/^0x/);
      expect(encodedData.length).toBeGreaterThan(10);
    });

    test('should validate Porto relay URL configuration', () => {
      expect(NETWORK_CONFIG.portoRelayUrl).toBe('https://rise-testnet-porto.fly.dev');
      expect(CONTRACTS.PortoDelegationProxy.address).toBe('0x894C14A66508D221A219Dd0064b4A6718d0AAA52');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network timeouts gracefully', async () => {
      // Mock timeout error
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      const status = await portoClient.checkDelegationStatus(testAccount.address);
      
      expect(status.isDelegated).toBe(false);
      expect(status.isPending).toBe(false);
    });

    test('should handle malformed JSON responses', async () => {
      // Mock invalid JSON response
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await portoClient.setupDelegation(testAccount.address, testAccount);
      expect(result.success).toBe(false);
    });

    test('should handle rate limiting responses', async () => {
      // Mock rate limit error
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          error: {
            code: 429,
            message: 'Too many requests',
          },
        }),
      });

      const result = await sessionWallet.executeTransaction({
        target: CONTRACTS.UnifiedCLOB.address,
        data: '0x1234',
        value: 0n,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many requests');
    });
  });
});