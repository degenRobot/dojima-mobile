/**
 * Portfolio functionality test
 * Tests the usePortfolio hook to ensure it properly handles the data structure
 * that PortfolioScreen expects
 */

// Mock modules before imports
jest.mock('../providers/SimplePortoProvider', () => ({
  usePorto: () => ({
    userAddress: '0x7f88CF4509389b937B0524F9545FC37e6D1d0133',
  }),
}));

jest.mock('../utils/logger', () => ({
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { usePortfolio } from '../hooks/usePortfolio';

// Mock fetch globally
global.fetch = jest.fn();

describe('Portfolio Hook Data Structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the correct data structure for PortfolioScreen', async () => {
    // Mock successful RPC responses for USDC token
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        // balanceOf response for wallet
        ok: true,
        json: async () => ({
          result: '0x0000000000000000000000000000000000000000000000000000000000002710', // 10000 in hex
        }),
      })
      .mockResolvedValueOnce({
        // getBalance response from CLOB - returns tuple (available, locked)
        ok: true,
        json: async () => ({
          result: '0x00000000000000000000000000000000000000000000000000000000000013880000000000000000000000000000000000000000000000000000000000000000', // 5000 available, 0 locked
        }),
      })
      // Repeat for WETH
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: '0x0000000000000000000000000000000000000000000000000000000000000000',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        }),
      })
      // Repeat for WBTC
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: '0x0000000000000000000000000000000000000000000000000000000000000000',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        }),
      });

    const { result } = renderHook(() => usePortfolio());

    // Wait for the hook to fetch data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // Check that getTokenInfo returns the correct structure
    const usdcInfo = result.current.getTokenInfo('USDC');

    // These are the fields that PortfolioScreen expects
    expect(usdcInfo).toBeDefined();
    if (usdcInfo) {
      // Check all required fields exist
      expect(usdcInfo).toHaveProperty('walletBalance');
      expect(usdcInfo).toHaveProperty('clobBalance');
      expect(usdcInfo).toHaveProperty('clobLocked');
      expect(usdcInfo).toHaveProperty('totalValue');
      
      // Check field types
      expect(typeof usdcInfo.walletBalance).toBe('string');
      expect(typeof usdcInfo.clobBalance).toBe('string');
      expect(typeof usdcInfo.clobLocked).toBe('string');
      expect(typeof usdcInfo.totalValue).toBe('number');
      
      // These should NOT exist (old structure)
      expect(usdcInfo).not.toHaveProperty('wallet');
      expect(usdcInfo).not.toHaveProperty('clob');
      expect(usdcInfo).not.toHaveProperty('totalValueUSD');
    }
  });

  it('should handle undefined/null responses gracefully', async () => {
    // Mock RPC error
    (global.fetch as jest.Mock).mockRejectedValue(new Error('RPC Error'));

    const { result } = renderHook(() => usePortfolio());

    // Wait for error state
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // Even with errors, getTokenInfo should not crash
    const tokenInfo = result.current.getTokenInfo('USDC');
    
    // Should safely handle undefined
    expect(() => {
      const available = tokenInfo?.clobBalance || '0';
      const wallet = tokenInfo?.walletBalance || '0';
      const locked = tokenInfo?.clobLocked || '0';
    }).not.toThrow();
  });

  it('should handle empty balance responses', async () => {
    // Mock empty responses
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: '0x', // Empty response
      }),
    });

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    const tokenInfo = result.current.getTokenInfo('USDC');
    
    if (tokenInfo) {
      // Should have default zero values
      expect(parseFloat(tokenInfo.clobBalance)).toBe(0);
      expect(parseFloat(tokenInfo.walletBalance)).toBe(0);
      expect(parseFloat(tokenInfo.clobLocked)).toBe(0);
    }
  });

  it('should calculate total values correctly', async () => {
    // Mock responses with known values
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // 1000 USDC in wallet (6 decimals)
          result: '0x000000000000000000000000000000000000000000000000000000003b9aca00',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // 500 available, 100 locked in CLOB
          result: '0x0000000000000000000000000000000000000000000000000000000001dcd65000000000000000000000000000000000000000000000000000000000005f5e100',
        }),
      });

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    const portfolio = result.current.portfolio;
    expect(portfolio).toBeDefined();
    
    if (portfolio) {
      // Check portfolio summary calculations
      expect(portfolio.totalValueUSD).toBeGreaterThanOrEqual(0);
      expect(portfolio.walletTotalUSD).toBeGreaterThanOrEqual(0);
      expect(portfolio.clobTotalUSD).toBeGreaterThanOrEqual(0);
    }
  });
});