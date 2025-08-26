import { useState, useEffect } from 'react';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';
import { contracts } from '@/contracts/contracts';

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  value: number;
  price: number;
  change24h: number;
}

export interface PortfolioData {
  totalValue: number;
  totalValueChange24h: number;
  totalValueChange24hPercent: number;
  balances: TokenBalance[];
}

// Hardcoded prices - TODO: In the future, these should come from the market price oracle or indexer
const PRICES = {
  WETH: 3000, // $3000 per WETH
  USDC: 1,    // $1 per USDC
};

export function useRealPortfolioData() {
  const { baseBalance, quoteBalance, baseToken, quoteToken } = useSimpleCLOB();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse balances
    const wethAmount = parseFloat(baseBalance || '0');
    const usdcAmount = parseFloat(quoteBalance || '0');

    // Calculate values
    const wethValue = wethAmount * PRICES.WETH;
    const usdcValue = usdcAmount * PRICES.USDC;
    const totalValue = wethValue + usdcValue;

    // Create balance objects
    const balances: TokenBalance[] = [
      {
        token: baseToken || contracts.WETH.address,
        symbol: 'WETH',
        amount: baseBalance || '0',
        price: PRICES.WETH,
        value: wethValue,
        change24h: 0, // TODO: Calculate from historical data
      },
      {
        token: quoteToken || contracts.USDC.address,
        symbol: 'USDC',
        amount: quoteBalance || '0',
        price: PRICES.USDC,
        value: usdcValue,
        change24h: 0, // USDC is stable, so 0% change
      },
    ];

    // TODO: Calculate 24h change from historical data
    // For now, we'll use placeholder values
    const totalValueChange24h = 0;
    const totalValueChange24hPercent = 0;

    setData({
      totalValue,
      totalValueChange24h,
      totalValueChange24hPercent,
      balances,
    });
    setLoading(false);
  }, [baseBalance, quoteBalance, baseToken, quoteToken]);

  return { 
    data, 
    loading,
    error: null,
    refetch: () => {
      // Refetch is handled automatically by useSimpleCLOB polling
    }
  };
}