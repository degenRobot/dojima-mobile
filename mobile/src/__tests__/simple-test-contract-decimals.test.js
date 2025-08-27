/**
 * Test for proper decimal handling with UnifiedCLOB contract
 */

import { 
  formatAmountForContract,
  formatPriceForContract,
  formatOrderForContract,
  parseAmountFromContract,
  normalizeAmountForContract
} from '../utils/contractDecimals';

describe('UnifiedCLOB Contract Decimal Handling', () => {
  describe('formatAmountForContract', () => {
    it('should always return 18 decimal format', () => {
      // WETH (18 decimals) - 1 WETH
      expect(formatAmountForContract(1, 'WETH')).toBe(BigInt(10 ** 18));
      
      // WBTC (8 decimals) - 0.01 WBTC 
      // Should be 0.01 * 10^18, NOT 0.01 * 10^8
      expect(formatAmountForContract(0.01, 'WBTC')).toBe(BigInt(0.01 * 10 ** 18));
      
      // USDC (6 decimals) - 100 USDC
      // Should be 100 * 10^18, NOT 100 * 10^6
      expect(formatAmountForContract(100, 'USDC')).toBe(BigInt(100 * 10 ** 18));
    });
  });
  
  describe('formatPriceForContract', () => {
    it('should use quote token decimals', () => {
      // Price in USDC (6 decimals)
      expect(formatPriceForContract(2000, 'USDC')).toBe(BigInt(2000 * 10 ** 6));
      
      // Price in WBTC (8 decimals)
      expect(formatPriceForContract(0.04, 'WBTC')).toBe(BigInt(0.04 * 10 ** 8));
      
      // Price in WETH (18 decimals)
      expect(formatPriceForContract(1, 'WETH')).toBe(BigInt(10 ** 18));
    });
  });
  
  describe('formatOrderForContract', () => {
    it('should format WETH/USDC order correctly', () => {
      const { amount, price, quoteAmount } = formatOrderForContract(
        1,    // WETH/USDC book
        true, // buy
        2000, // 2000 USDC per WETH
        0.1   // 0.1 WETH
      );
      
      // Amount should be 0.1 * 10^18
      expect(amount).toBe(BigInt(0.1 * 10 ** 18));
      
      // Price should be 2000 * 10^6 (USDC decimals)
      expect(price).toBe(BigInt(2000 * 10 ** 6));
      
      // Quote amount: (0.1 * 10^18 * 2000 * 10^6) / 10^18 = 200 * 10^6
      expect(quoteAmount).toBe(BigInt(200 * 10 ** 6));
    });
    
    it('should format WBTC/USDC order correctly', () => {
      const { amount, price, quoteAmount } = formatOrderForContract(
        2,     // WBTC/USDC book
        true,  // buy
        50000, // 50000 USDC per WBTC
        0.01   // 0.01 WBTC
      );
      
      // Amount should be 0.01 * 10^18 (normalized to 18 decimals)
      expect(amount).toBe(BigInt(0.01 * 10 ** 18));
      
      // Price should be 50000 * 10^6 (USDC decimals)
      expect(price).toBe(BigInt(50000 * 10 ** 6));
      
      // Quote amount: (0.01 * 10^18 * 50000 * 10^6) / 10^18 = 500 * 10^6
      expect(quoteAmount).toBe(BigInt(500 * 10 ** 6));
    });
    
    it('should format WETH/WBTC order correctly', () => {
      const { amount, price, quoteAmount } = formatOrderForContract(
        3,    // WETH/WBTC book
        true, // buy
        0.04, // 0.04 BTC per ETH
        1     // 1 WETH
      );
      
      // Amount should be 1 * 10^18
      expect(amount).toBe(BigInt(10 ** 18));
      
      // Price should be 0.04 * 10^8 (WBTC decimals)
      expect(price).toBe(BigInt(0.04 * 10 ** 8));
      
      // Quote amount: (1 * 10^18 * 0.04 * 10^8) / 10^18 = 0.04 * 10^8
      expect(quoteAmount).toBe(BigInt(0.04 * 10 ** 8));
    });
  });
  
  describe('parseAmountFromContract', () => {
    it('should convert 18-decimal amounts back to token decimals', () => {
      // WETH: 18 -> 18 (no change)
      const wethAmount = BigInt(10 ** 18); // 1 WETH
      expect(parseAmountFromContract(wethAmount, 'WETH')).toBe(BigInt(10 ** 18));
      
      // WBTC: 18 -> 8
      const wbtcAmount = BigInt(0.01 * 10 ** 18); // 0.01 in 18 decimals
      expect(parseAmountFromContract(wbtcAmount, 'WBTC')).toBe(BigInt(0.01 * 10 ** 8));
      
      // USDC: 18 -> 6  
      const usdcAmount = BigInt(100 * 10 ** 18); // 100 in 18 decimals
      expect(parseAmountFromContract(usdcAmount, 'USDC')).toBe(BigInt(100 * 10 ** 6));
    });
  });
  
  describe('normalizeAmountForContract', () => {
    it('should convert token decimals to 18 decimals', () => {
      // WETH: 18 -> 18 (no change)
      expect(normalizeAmountForContract(BigInt(10 ** 18), 'WETH')).toBe(BigInt(10 ** 18));
      
      // WBTC: 8 -> 18
      expect(normalizeAmountForContract(BigInt(10 ** 8), 'WBTC')).toBe(BigInt(10 ** 18));
      
      // USDC: 6 -> 18
      expect(normalizeAmountForContract(BigInt(10 ** 6), 'USDC')).toBe(BigInt(10 ** 18));
    });
  });
  
  describe('Real-world scenarios', () => {
    it('should handle small WBTC amounts correctly', () => {
      // Buy 0.001 WBTC at 45000 USDC
      const { amount, price, quoteAmount } = formatOrderForContract(
        2,     // WBTC/USDC
        true,  
        45000,
        0.001
      );
      
      // Quote needed: 0.001 * 45000 = 45 USDC
      expect(quoteAmount).toBe(BigInt(45 * 10 ** 6));
    });
    
    it('should handle large WETH amounts correctly', () => {
      // Buy 10 WETH at 1850 USDC
      const { amount, price, quoteAmount } = formatOrderForContract(
        1,    // WETH/USDC
        true,
        1850,
        10
      );
      
      // Quote needed: 10 * 1850 = 18500 USDC
      expect(quoteAmount).toBe(BigInt(18500 * 10 ** 6));
    });
  });
});