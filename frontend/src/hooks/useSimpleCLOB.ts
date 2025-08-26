import { useEffect, useState } from 'react';
import { formatEther, parseUnits, formatUnits } from 'viem';
import { createContractHook } from '@/hooks/useContractFactory';
import { contracts } from '@/contracts/contracts';
import { useAccount } from 'wagmi';
import { createTransactionCallbacks } from '@/lib/transaction-callbacks';

// Create contract hooks
const useEnhancedSpotBookContract = createContractHook('EnhancedSpotBook');
const useUSDCContract = createContractHook('USDC');
const useWETHContract = createContractHook('WETH');

export function useSimpleCLOB() {
  const { address } = useAccount();
  const { read: readCLOB, write: writeCLOB, isLoading: isCLOBLoading } = useEnhancedSpotBookContract();
  const { write: writeUSDC, isLoading: isUSDCLoading } = useUSDCContract();
  const { write: writeWETH, isLoading: isWETHLoading } = useWETHContract();
  
  // State for contract data
  const [baseToken, setBaseToken] = useState<string>('');
  const [quoteToken, setQuoteToken] = useState<string>('');
  const [baseBalance, setBaseBalance] = useState<bigint>(0n);
  const [quoteBalance, setQuoteBalance] = useState<bigint>(0n);
  const [bestBid, setBestBid] = useState<bigint>(0n);
  const [bestAsk, setBestAsk] = useState<bigint>(0n);
  
  // Get token addresses
  useEffect(() => {
    async function getTokens() {
      try {
        const base = await readCLOB('baseToken', []) as string;
        const quote = await readCLOB('quoteToken', []) as string;
        setBaseToken(base);
        setQuoteToken(quote);
      } catch {
        // Error getting tokens, silently continue
      }
    }
    getTokens();
  }, [readCLOB]);
  
  // Get balances
  useEffect(() => {
    async function getBalances() {
      if (!address) return;
      
      try {
        const [baseResult, quoteResult] = await Promise.all([
          readCLOB('getBalance', [address, baseToken]) as Promise<[bigint, bigint]>,
          readCLOB('getBalance', [address, quoteToken]) as Promise<[bigint, bigint]>,
        ]);
        
        // getBalance returns [available, locked] tuple - we want the available balance
        setBaseBalance(baseResult[0]);
        setQuoteBalance(quoteResult[0]);
      } catch {
        // Error getting balances, silently continue
      }
    }
    
    if (baseToken && quoteToken) {
      getBalances();
      const interval = setInterval(getBalances, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [address, baseToken, quoteToken, readCLOB]);
  
  // Get best bid and ask prices
  useEffect(() => {
    async function getPrices() {
      try {
        const [bidResult, askResult] = await Promise.all([
          readCLOB('getBestBid', []) as Promise<readonly [bigint, bigint]>,
          readCLOB('getBestAsk', []) as Promise<readonly [bigint, bigint]>,
        ]);
        
        // The functions return [price, amount] tuples
        setBestBid(bidResult[0]);
        setBestAsk(askResult[0]);
      } catch {
        // Error getting prices, silently continue
      }
    }
    
    getPrices();
    const interval = setInterval(getPrices, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [readCLOB]);
  
  // Helper functions
  const approveToken = async (token: 'base' | 'quote', amount: string) => {
    const decimals = token === 'base' ? 18 : 6; // WETH: 18, USDC: 6
    const parsedAmount = parseUnits(amount, decimals);
    const tokenSymbol = token === 'base' ? 'WETH' : 'USDC';
    
    try {
      const writeFunc = token === 'base' ? writeWETH : writeUSDC;
      
      const callbacks = createTransactionCallbacks({
        action: 'Approve Token',
        details: {
          token: tokenSymbol,
          amount: amount,
          spender: 'EnhancedSpotBook'
        }
      });
      
      await writeFunc('approve', [contracts.EnhancedSpotBook.address, parsedAmount], {
        callbacks,
        metadata: {
          action: 'Approve Token',
          details: {
            token: tokenSymbol,
            amount: amount,
            spender: 'EnhancedSpotBook'
          }
        }
      });
    } catch (error) {
      throw error;
    }
  };

  const depositToken = async (token: 'base' | 'quote', amount: string) => {
    const tokenAddress = token === 'base' ? baseToken : quoteToken;
    const decimals = token === 'base' ? 18 : 6;
    const parsedAmount = parseUnits(amount, decimals);
    const tokenSymbol = token === 'base' ? 'WETH' : 'USDC';
    
    try {
      const callbacks = createTransactionCallbacks({
        action: 'Deposit',
        details: {
          token: tokenSymbol,
          amount: amount
        }
      });
      
      await writeCLOB('deposit', [tokenAddress, parsedAmount], {
        callbacks,
        metadata: {
          action: 'Deposit',
          details: {
            token: tokenSymbol,
            amount: amount
          }
        }
      });
    } catch (error) {
      throw error;
    }
  };

  const withdrawToken = async (token: 'base' | 'quote', amount: string) => {
    const tokenAddress = token === 'base' ? baseToken : quoteToken;
    const decimals = token === 'base' ? 18 : 6;
    const parsedAmount = parseUnits(amount, decimals);
    const tokenSymbol = token === 'base' ? 'WETH' : 'USDC';
    
    try {
      const callbacks = createTransactionCallbacks({
        action: 'Withdraw',
        details: {
          token: tokenSymbol,
          amount: amount
        }
      });
      
      await writeCLOB('withdraw', [tokenAddress, parsedAmount], {
        callbacks,
        metadata: {
          action: 'Withdraw',
          details: {
            token: tokenSymbol,
            amount: amount
          }
        }
      });
    } catch (error) {
      throw error;
    }
  };

  // Market orders removed - use limit orders instead

  return {
    // Token addresses
    baseToken,
    quoteToken,
    
    // Balances
    baseBalance: baseBalance ? formatEther(baseBalance) : '0',
    quoteBalance: quoteBalance ? formatUnits(quoteBalance, 6) : '0',
    
    // Prices
    bestBid: bestBid ? formatEther(bestBid) : '0',
    bestAsk: bestAsk ? formatEther(bestAsk) : '0',
    midPrice: bestBid && bestAsk ? formatEther((bestBid + bestAsk) / 2n) : '0',
    
    // Functions
    approveToken,
    depositToken,
    withdrawToken,
    
    // Loading states
    isLoading: isCLOBLoading || isUSDCLoading || isWETHLoading,
  };
}