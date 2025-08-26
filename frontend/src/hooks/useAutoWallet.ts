import { useEffect } from 'react';
import { generatePrivateKey } from 'viem/accounts';

const STORAGE_KEY = 'rise-embedded-wallet';

export function useAutoWallet() {
  useEffect(() => {
    // Check if user already has a wallet in storage
    const existingWallet = localStorage.getItem(STORAGE_KEY);
    
    if (!existingWallet) {
      // Generate a new private key for the user
      const privateKey = generatePrivateKey();
      localStorage.setItem(STORAGE_KEY, privateKey);
    }
  }, []);
}

export function resetWallet() {
  // Generate a new private key
  const privateKey = generatePrivateKey();
  localStorage.setItem(STORAGE_KEY, privateKey);
  
  // Reload the page to reconnect with new wallet
  window.location.reload();
}