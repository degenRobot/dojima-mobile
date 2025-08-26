'use client';

import { useState } from 'react';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function TradingPanel() {
  const {
    baseBalance,
    quoteBalance,
    midPrice,
    approveToken,
    depositToken,
    withdrawToken,
    isLoading,
  } = useSimpleCLOB();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'base' | 'quote'>('quote');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Your Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">WETH (Base)</span>
            <span className="font-mono font-medium">{baseBalance}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">USDC (Quote)</span>
            <span className="font-mono font-medium">{quoteBalance}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current Price</span>
            <Badge variant="secondary" className="font-mono">
              ${midPrice} USDC/WETH
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Deposit/Withdraw */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit / Withdraw</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Token</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={selectedToken === 'base' ? 'default' : 'outline'}
                onClick={() => setSelectedToken('base')}
              >
                WETH
              </Button>
              <Button
                size="sm"
                variant={selectedToken === 'quote' ? 'default' : 'outline'}
                onClick={() => setSelectedToken('quote')}
              >
                USDC
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Deposit Amount</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button
                onClick={() => approveToken(selectedToken, depositAmount)}
                disabled={isLoading || !depositAmount}
                variant="outline"
                size="sm"
              >
                Approve
              </Button>
              <Button
                onClick={() => depositToken(selectedToken, depositAmount)}
                disabled={isLoading || !depositAmount}
              >
                {isLoading ? 'Depositing...' : 'Deposit'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Withdraw Amount</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <Button
                onClick={() => withdrawToken(selectedToken, withdrawAmount)}
                disabled={isLoading || !withdrawAmount}
                variant="outline"
              >
                {isLoading ? 'Withdrawing...' : 'Withdraw'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Info */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Trading Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8">
              <p className="text-lg font-medium mb-2">Use the Trade Page for Trading</p>
              <p className="text-muted-foreground mb-4">
                Place limit orders on the main trading interface.
              </p>
              <Button
                onClick={() => window.location.href = '/trade/WETH-USDC'}
                className="japanese-button-primary"
              >
                Go to Trade Page
              </Button>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground text-center">
                Current Mid Price: ${midPrice} USDC/WETH
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}