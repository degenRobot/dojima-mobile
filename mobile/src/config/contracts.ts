// Contract addresses and ABIs for RISE Testnet
import { UnifiedCLOBV2ABI } from './abis';
import { MintableERC20ABI } from './abis';
// Chain ID: 11155931

export const CONTRACTS = {
  // UnifiedCLOBV2 Contract (LATEST deployment with separate match function)
  UnifiedCLOB: {
    address: '0x92025983Ab5641378893C3932A1a43e214e7446D' as const,
    abi: UnifiedCLOBV2ABI,
  },
  
  // Tokens (LATEST deployment with correct decimals)
  USDC: {
    address: '0xaE3A504B9Fe27cf2ff3Ed3e36bE037AD36a1a48a' as const,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    abi: MintableERC20ABI,
  },
  WETH: {
    address: '0x3Af2aed9FFA29b2a0e387a2Fb45a540A66f4D2b4' as const,
    decimals: 18,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    abi: MintableERC20ABI,
  },
  WBTC: {
    address: '0x30301403f92915c8731880eF595c20C8C6059369' as const,
    decimals: 8,
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    abi: MintableERC20ABI,
  },
  
  // Porto Protocol (for gasless transactions)
  PortoOrchestrator: {
    address: '0xa4D0537eEAB875C9a880580f38862C1f946bFc1c' as const,
  },
  PortoDelegationProxy: {
    address: '0x894C14A66508D221A219Dd0064b4A6718d0AAA52' as const,
  },
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  chainId: 11155931,
  chainName: 'RISE Testnet',
  rpcUrl: 'https://indexing.testnet.riselabs.xyz',
  wsUrl: 'wss://testnet.riselabs.xyz/ws',
  explorerUrl: 'https://testnet-explorer.riselabs.xyz',
  portoRelayUrl: 'https://rise-testnet-porto.fly.dev',
} as const;

// Trading books configuration for UnifiedCLOB
export const TRADING_BOOKS = [
  { 
    id: 1,
    base: 'WETH',
    quote: 'USDC',
    symbol: 'WETH/USDC',
    baseDecimals: 18,
    quoteDecimals: 6,
    description: 'Ethereum / USD Coin'
  },
  { 
    id: 2,
    base: 'WBTC',
    quote: 'USDC',
    symbol: 'WBTC/USDC',
    baseDecimals: 8,
    quoteDecimals: 6,
    description: 'Bitcoin / USD Coin'
  },
  { 
    id: 3,
    base: 'WETH',
    quote: 'WBTC',
    symbol: 'WETH/WBTC',
    baseDecimals: 18,
    quoteDecimals: 8,
    description: 'Ethereum / Bitcoin'
  },
] as const;

// Fee configuration (fixed in UnifiedCLOB)
export const FEE_CONFIG = {
  makerFee: 0.001, // 0.1%
  takerFee: 0.002, // 0.2%
} as const;

// Helper to get token info by symbol
export const getTokenBySymbol = (symbol: string) => {
  const tokens = { USDC: CONTRACTS.USDC, WETH: CONTRACTS.WETH, WBTC: CONTRACTS.WBTC };
  return tokens[symbol as keyof typeof tokens];
};