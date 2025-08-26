import { useAccount, useSwitchChain } from 'wagmi';
import { useCallback } from 'react';
import { riseTestnet } from '@/lib/wagmi-config';
import { toast } from '@/lib/toast-manager';

export function useEnsureNetwork() {
  const { chain, connector } = useAccount();
  const { switchChain } = useSwitchChain();

  const ensureCorrectNetwork = useCallback(async () => {
    // If using embedded wallet, it's always on the right network
    if (connector?.id === 'embedded-wallet') {
      return true;
    }

    // Check if we're on the right network
    if (chain?.id === riseTestnet.id) {
      return true;
    }

    // For MetaMask, check the actual network
    if (typeof window !== 'undefined' && (window as { ethereum?: unknown }).ethereum) {
      try {
        const chainIdHex = await (window as { ethereum: { request: (args: { method: string }) => Promise<string> } }).ethereum.request({ 
          method: 'eth_chainId' 
        });
        const currentChainId = parseInt(chainIdHex, 16);
        

        if (currentChainId !== riseTestnet.id) {
          // Try to switch network
          try {
            await (window as { ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<void> } }).ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa6c7b' }], // 11155931 in hex
            });
            return true;
          } catch (switchError) {
            // If chain doesn't exist, add it
            if ((switchError as { code?: number }).code === 4902) {
              try {
                await (window as { ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<void> } }).ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0xaa6c7b',
                    chainName: 'RISE Testnet',
                    nativeCurrency: {
                      name: 'Ether',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    rpcUrls: ['https://testnet.riselabs.xyz'],
                    blockExplorerUrls: ['https://explorer.testnet.riselabs.xyz'],
                  }],
                });
                return true;
              } catch {
                throw new Error('Please add RISE Testnet to MetaMask manually');
              }
            } else {
              throw new Error('Please switch to RISE Testnet in MetaMask');
            }
          }
        }
        return true;
      } catch (error) {
        throw error;
      }
    }

    // Try using wagmi's switchChain as fallback
    if (switchChain) {
      try {
        await switchChain({ chainId: riseTestnet.id });
        return true;
      } catch (error) {
        throw error;
      }
    }

    throw new Error('Unable to switch to RISE Testnet');
  }, [chain, connector, switchChain]);

  const addRiseNetwork = useCallback(async () => {
    if (!(window as { ethereum?: unknown }).ethereum) {
      toast.error('MetaMask is not installed.');
      return false;
    }

    try {
      await (window as { ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<void> } }).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0xaa6c7b', // 11155931 in hex
            chainName: 'RISE Testnet',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://testnet.riselabs.xyz'],
            blockExplorerUrls: ['https://explorer.testnet.riselabs.xyz'],
          },
        ],
      });
      toast.success('RISE network added successfully!');
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === 4001) {
        toast.error('User rejected the request.');
      } else {
        toast.error('Could not add RISE network.');
      }
      return false;
    }
  }, []);

  return { ensureCorrectNetwork, addRiseNetwork };
}