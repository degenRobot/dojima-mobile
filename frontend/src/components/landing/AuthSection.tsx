'use client';

import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { WalletSelector } from '@/components/WalletSelector';
import { useEffect } from 'react';

export function AuthSection() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Redirect to portfolio if already connected
  useEffect(() => {
    if (isConnected && address) {
      router.push('/portfolio');
    }
  }, [isConnected, address, router]);

  if (isConnected && address) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-lg text-gray-200">
        Connect your wallet to start trading
      </p>
      <div className="flex justify-center">
        <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg">
          <WalletSelector />
        </div>
      </div>
    </div>
  );
}