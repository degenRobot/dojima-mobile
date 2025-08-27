import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Wallet {
  address: string;
  privateKey: string;
}

interface WalletStore {
  wallet: Wallet | null;
  isLoading: boolean;
  setWallet: (wallet: Wallet | null) => void;
  loadWallet: () => Promise<void>;
  clearWallet: () => Promise<void>;
}

export const useWalletStore = create<WalletStore>((set) => ({
  wallet: null,
  isLoading: false,

  setWallet: (wallet) => set({ wallet }),

  loadWallet: async () => {
    set({ isLoading: true });
    try {
      const privateKey = await AsyncStorage.getItem('wallet_private_key');
      const address = await AsyncStorage.getItem('wallet_address');
      
      if (privateKey && address) {
        set({ wallet: { address, privateKey } });
      }
    } catch (error) {
      console.error('Failed to load wallet:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  clearWallet: async () => {
    try {
      await AsyncStorage.removeItem('wallet_private_key');
      await AsyncStorage.removeItem('wallet_address');
      set({ wallet: null });
    } catch (error) {
      console.error('Failed to clear wallet:', error);
    }
  },
}));