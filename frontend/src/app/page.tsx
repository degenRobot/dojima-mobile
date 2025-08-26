'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { AuthSection } from '@/components/landing/AuthSection';

export default function HomePage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  // Redirect to portfolio if already connected
  useEffect(() => {
    if (isConnected) {
      router.push('/portfolio');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <AuthSection />
      
      {/* Additional sections can be added here */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 japanese-heading">
            Trade with Honor
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience the world&apos;s most advanced decentralized trading platform, 
            inspired by centuries of Japanese trading tradition.
          </p>
        </div>
      </section>
    </div>
  );
}