'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';
import { useLimitOrders } from '@/hooks/useLimitOrders';
import { toast } from 'sonner';

interface OrderFormProps {
  pair: string;
}

export function OrderForm({ pair }: OrderFormProps) {
  const { baseBalance, quoteBalance, bestBid, bestAsk, midPrice, isLoading } = useSimpleCLOB();
  const { placeLimitOrder, isLoading: isLimitLoading } = useLimitOrders();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [percentage, setPercentage] = useState(0);

  // Calculate max amounts based on balances
  const maxBuyAmount = parseFloat(quoteBalance) / 1000; // Assuming price of 1000
  const maxSellAmount = parseFloat(baseBalance);

  const handlePercentageChange = (value: number[]) => {
    const pct = value[0];
    setPercentage(pct);
    
    const maxAmount = side === 'buy' ? maxBuyAmount : maxSellAmount;
    const calculatedAmount = (maxAmount * pct / 100).toFixed(6);
    setAmount(calculatedAmount);
  };

  const handleSubmit = async () => {
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      
      await placeLimitOrder(side, price, amount);
      
      // Reset form
      setAmount('');
      setPrice('');
      setPercentage(0);
    } catch {
      // Order error handled by placeLimitOrder hook
    }
  };

  return (
    <div className="space-y-4">
      {/* Order Type - Limit Only */}
      <div className="text-center text-sm text-muted-foreground mb-2">
        Limit Orders Only
      </div>

      {/* Buy/Sell Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={side === 'buy' ? 'default' : 'outline'}
          onClick={() => setSide('buy')}
          className={side === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          Buy
        </Button>
        <Button
          variant={side === 'sell' ? 'destructive' : 'outline'}
          onClick={() => setSide('sell')}
        >
          Sell
        </Button>
      </div>

      {/* Price Input */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Price</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              const priceToSet = side === 'buy' ? bestAsk : bestBid;
              setPrice(parseFloat(priceToSet).toFixed(2));
            }}
          >
            Use {side === 'buy' ? 'Ask' : 'Bid'}
          </Button>
        </div>
        <Input
          type="number"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Amount</Label>
          <span className="text-sm text-muted-foreground">
            Balance: {side === 'buy' ? quoteBalance + ' USDC' : baseBalance + ' WETH'}
          </span>
        </div>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            // Update percentage slider
            const maxAmount = side === 'buy' ? maxBuyAmount : maxSellAmount;
            const pct = maxAmount > 0 ? (parseFloat(e.target.value) / maxAmount) * 100 : 0;
            setPercentage(Math.min(100, Math.max(0, pct)));
          }}
        />
      </div>

      {/* Percentage Slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
        <Slider
          value={[percentage]}
          onValueChange={handlePercentageChange}
          max={100}
          step={1}
          className="w-full"
        />
      </div>

      {/* Order Summary */}
      <div className="space-y-2 p-3 bg-muted rounded-md">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono">
            {side === 'buy' 
              ? `${(parseFloat(amount || '0') * parseFloat(price || '0')).toFixed(2)} USDC`
              : `${amount || '0'} WETH`
            }
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fee (0.3%)</span>
          <span className="font-mono">
            {side === 'buy'
              ? `${(parseFloat(amount || '0') * parseFloat(price || '0') * 0.003).toFixed(2)} USDC`
              : `${(parseFloat(amount || '0') * 0.003).toFixed(6)} WETH`
            }
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || isLimitLoading || !amount || parseFloat(amount) <= 0 || !price || parseFloat(price) <= 0}
        className={`w-full ${
          side === 'buy' 
            ? 'bg-green-600 hover:bg-green-700' 
            : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {isLoading ? 'Processing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${pair.split('-')[0]}`}
      </Button>

      {/* Current Price Display */}
      <div className="space-y-1">
        <div className="text-center text-sm text-muted-foreground">
          Mid Price: <Badge variant="secondary" className="font-mono">{parseFloat(midPrice).toFixed(2)} USDC/WETH</Badge>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Best Bid: {parseFloat(bestBid).toFixed(2)}</span>
          <span>Best Ask: {parseFloat(bestAsk).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}