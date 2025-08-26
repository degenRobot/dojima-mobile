'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
}

// Mock trading pairs data
const TRADING_PAIRS: TradingPair[] = [
  {
    symbol: 'WETH-USDC',
    baseAsset: 'WETH',
    quoteAsset: 'USDC',
    price: 2150,
    change24h: 2.5,
    volume24h: 1234567,
  },
  {
    symbol: 'BTC-USDC',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    price: 45000,
    change24h: -1.2,
    volume24h: 5678901,
  },
  // Add more pairs as needed
];

interface PairSelectorProps {
  currentPair: string;
}

export function PairSelector({ currentPair }: PairSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedPair = TRADING_PAIRS.find(p => p.symbol === currentPair) || TRADING_PAIRS[0];

  const handlePairChange = (pair: TradingPair) => {
    router.push(`/trade/${pair.symbol}`);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-4">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <span className="text-lg font-semibold">{selectedPair.symbol}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          {TRADING_PAIRS.map((pair) => (
            <DropdownMenuItem
              key={pair.symbol}
              onClick={() => handlePairChange(pair)}
              className="flex items-center justify-between py-3"
            >
              <div>
                <div className="font-medium">{pair.symbol}</div>
                <div className="text-sm text-muted-foreground">
                  Vol: ${pair.volume24h.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">${pair.price.toLocaleString()}</div>
                <Badge 
                  variant={pair.change24h >= 0 ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {pair.change24h >= 0 ? '+' : ''}{pair.change24h}%
                </Badge>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Current Price Display */}
      <div className="flex items-center gap-6">
        <div>
          <div className="text-2xl font-bold font-mono">
            ${selectedPair.price.toLocaleString()}
          </div>
          <div className={`text-sm ${selectedPair.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {selectedPair.change24h >= 0 ? '+' : ''}{selectedPair.change24h}%
          </div>
        </div>
      </div>
    </div>
  );
}