/**
 * Environment configuration
 * Uses Expo's EXPO_PUBLIC_ prefix for client-side environment variables
 */

// Network configuration from environment
export const ENV = {
  RPC_URL: process.env.EXPO_PUBLIC_RPC_URL || 'https://indexing.testnet.riselabs.xyz',
  WS_URL: process.env.EXPO_PUBLIC_WS_URL || 'wss://testnet.riselabs.xyz/ws',
  PORTO_RELAY_URL: process.env.EXPO_PUBLIC_PORTO_RELAY_URL || 'https://rise-testnet-porto.fly.dev',
  
  // Optional API keys
  ETHERSCAN_API_KEY: process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY,
} as const;

// Test keys should only be used in test files, not in production code
export const getTestPrivateKey = (account: 'alice' | 'bob'): string => {
  if (__DEV__) {
    const key = account === 'alice' 
      ? process.env.TEST_PRIVATE_KEY_ALICE 
      : process.env.TEST_PRIVATE_KEY_BOB;
    
    if (!key) {
      console.warn(`Test private key for ${account} not found in environment`);
    }
    
    return key || '';
  }
  
  throw new Error('Test private keys should only be accessed in development mode');
};