import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';
import { NETWORK_CONFIG } from './contracts';

// Define RISE testnet chain
export const riseTestnet = defineChain({
  id: NETWORK_CONFIG.chainId,
  name: 'RISE Testnet',
  network: 'rise-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [NETWORK_CONFIG.rpcUrl],
      webSocket: [NETWORK_CONFIG.wsUrl],
    },
    public: {
      http: [NETWORK_CONFIG.rpcUrl],
      webSocket: [NETWORK_CONFIG.wsUrl],
    },
  },
  blockExplorers: {
    default: { 
      name: 'RISE Explorer', 
      url: NETWORK_CONFIG.explorerUrl 
    },
  },
});

// Create public client for reading from the blockchain
export const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

// Create a dummy wallet client for compatibility
// In React Native, actual transactions go through Porto or wallet store
export const walletClient = {
  account: null,
  chain: riseTestnet,
  transport: http(NETWORK_CONFIG.rpcUrl),
  // Dummy methods that should not be called directly
  writeContract: async () => {
    throw new Error('Use Porto provider or wallet store for transactions');
  },
  sendTransaction: async () => {
    throw new Error('Use Porto provider or wallet store for transactions');
  },
};

// Export wallet client factory for writing to the blockchain
export const createWalletClientFromPrivateKey = (privateKey: `0x${string}`) => {
  // This would be used for wallet operations
  // In React Native, we'll use the wallet store instead
  throw new Error('Use wallet store for transactions in React Native');
};