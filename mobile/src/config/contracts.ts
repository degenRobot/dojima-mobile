// Contract addresses and ABIs for RISE Testnet
// Chain ID: 11155931

export const CONTRACTS = {
  // CLOB Contracts
  CLOBRegistry: {
    address: '0x8d2de392B884e33f2C3d63030032b16Be80ecc86' as const,
  },
  GlobalFeeHook: {
    address: '0x755FED03D11B6fACc7e48cdB69D50D2128D0ae2d' as const,
  },
  FeeDistributor: {
    address: '0x6863CAC91AC1b931D32B9253f51d2315F487A453' as const,
  },
  CLOBFactoryModular: {
    address: '0x4a7BEA07af40AA5f4d79A68EF2549662B3Dd4842' as const,
  },
  SpotFactory: {
    address: '0xb4d719B6131E9E924d693321c0c4cCE03041d2f2' as const,
  },
  EnhancedSpotBook: {
    address: '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222' as const,
  },
  
  // Tokens
  WETH: {
    address: '0xb5a1a0eB48a5CE19fD32D96C893A1A3B931C1a83' as const,
  },
  USDC: {
    address: '0xC6C7F99020CcECaEa2CEc088E09F1f3D13529DA9' as const,
  },
  RISE: {
    address: '0xFb18F7FF59C604c82802C33fc60C93fbd59d0D20' as const,
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

// Trading pairs configuration
export const TRADING_PAIRS = [
  { base: 'WETH', quote: 'USDC', symbol: 'WETH/USDC' },
  { base: 'RISE', quote: 'USDC', symbol: 'RISE/USDC' },
  { base: 'WETH', quote: 'RISE', symbol: 'WETH/RISE' },
] as const;

// Fee configuration
export const FEE_CONFIG = {
  makerFee: 0.001, // 0.1%
  takerFee: 0.002, // 0.2%
} as const;