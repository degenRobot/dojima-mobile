'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AuthSection } from './AuthSection';

interface PlatformStats {
  totalVolume: string;
  totalTrades: string;
  activeUsers: string;
  markets: string;
}

export function HeroSection() {
  const [stats, setStats] = useState<PlatformStats>({
    totalVolume: '$0',
    totalTrades: '0',
    activeUsers: '0',
    markets: '0',
  });

  useEffect(() => {
    // TODO: Fetch real stats from indexer API
    // const fetchStats = async () => {
    //   const response = await fetch('/api/stats');
    //   const data = await response.json();
    //   setStats(data);
    // };
    
    // Mock data with animation
    setTimeout(() => {
      setStats({
        totalVolume: '$12.5M',
        totalTrades: '45,231',
        activeUsers: '1,892',
        markets: '8',
      });
    }, 500);
  }, []);

  return (
    <section className="hero-japanese relative min-h-[600px] overflow-hidden">
      {/* Background Image */}
      <div className="hero-background">
        <Image
          src="/images/dojima.png"
          alt="Dojima Rice Exchange"
          fill
          className="object-cover"
          priority
        />
      </div>
      
      {/* Content */}
      <div className="hero-content max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-8">
          {/* Text content */}
          <div className="space-y-6 animate-fade-in-up max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold text-white">
              Dojima CLOB
            </h1>
            <p className="text-xl text-gray-200">
              The world&apos;s first rice exchange, reimagined for the digital age.
              Trade with honor on RISE Chain.
            </p>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
              <div className="space-y-1">
                <p className="text-sm text-gray-300">Total Volume</p>
                <p className="text-2xl font-bold text-white">{stats.totalVolume}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-300">Total Trades</p>
                <p className="text-2xl font-bold text-white">{stats.totalTrades}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-300">Active Users</p>
                <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-300">Markets</p>
                <p className="text-2xl font-bold text-white">{stats.markets}</p>
              </div>
            </div>
          </div>
          
          {/* Auth Section - Centered below stats */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <AuthSection />
          </div>
        </div>
      </div>
      
      {/* Decorative wave pattern at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-gray-900 to-transparent" />
    </section>
  );
}