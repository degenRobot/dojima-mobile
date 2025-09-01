// Contract addresses and ABIs for RISE Testnet
import { UnifiedCLOBV2ABI } from './abis';
import { MintableERC20ABI } from './abis';
// Chain ID: 11155931

export const CONTRACTS = {
  // UnifiedCLOBV2 Contract (LATEST deployment with market orders support)
  UnifiedCLOB: {
    address: '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C' as const,
    abi: UnifiedCLOBV2ABI,
  },
  
  // Tokens (LATEST deployment with correct decimals)
  USDC: {
    address: '0xC23b6B892c947746984474d52BBDF4ADd25717B3' as const,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    abi: MintableERC20ABI,
  },
  WETH: {
    address: '0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4' as const,
    decimals: 18,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    abi: MintableERC20ABI,
  },
  WBTC: {
    address: '0x7C4B1b2953Fd3bB0A4aC07da70b0839d1d09c2cA' as const,
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
  indexerUrl: process.env.EXPO_PUBLIC_INDEXER_URL || 'http://localhost:42069', // Ponder GraphQL endpoint
} as const;

// Feature flags
export const FEATURES = {
  indexer: true, // Enable indexer integration
  websocket: true, // WebSocket is now implemented
  analytics: false, // Analytics not implemented yet
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