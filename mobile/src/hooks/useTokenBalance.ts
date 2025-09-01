import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { NETWORK_CONFIG, CONTRACTS } from '../config/contracts';
import { logError } from '../utils/logger';

const publicClient = createPublicClient({
  chain: {
    id: NETWORK_CONFIG.chainId,
    name: 'RISE Testnet',
    network: 'rise-testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: [NETWORK_CONFIG.rpcUrl],
      },
      public: {
        http: [NETWORK_CONFIG.rpcUrl],
      },
    },
  },
  transport: http(NETWORK_CONFIG.rpcUrl),
});

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useTokenBalance(
  tokenSymbol: 'USDC' | 'WETH' | 'WBTC',
  userAddress?: string
) {
  const query = useQuery({
    queryKey: ['tokenBalance', tokenSymbol, userAddress],
    queryFn: async () => {
      if (!userAddress) {
        return { value: 0n, formatted: '0', symbol: tokenSymbol };
      }

      try {
        const contract = CONTRACTS[tokenSymbol];
        if (!contract) {
          throw new Error(`Contract not found for ${tokenSymbol}`);
        }

        const balance = await publicClient.readContract({
          address: contract.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`],
        });

        return {
          value: balance,
          formatted: formatUnits(balance, contract.decimals),
          symbol: tokenSymbol,
        };
      } catch (error) {
        logError('useTokenBalance', 'Failed to fetch balance', {
          token: tokenSymbol,
          address: userAddress,
          error,
        });
        return { value: 0n, formatted: '0', symbol: tokenSymbol };
      }
    },
    enabled: !!userAddress,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  return {
    balance: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}