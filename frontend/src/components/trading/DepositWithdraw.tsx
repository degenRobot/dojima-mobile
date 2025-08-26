'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';

export function DepositWithdraw() {
  const { address } = useAccount();
  const { 
    baseBalance, 
    quoteBalance, 
    approveToken, 
    depositToken, 
    withdrawToken, 
    isLoading 
  } = useSimpleCLOB();
  
  const [amounts, setAmounts] = useState({
    depositBase: '',
    depositQuote: '',
    withdrawBase: '',
    withdrawQuote: '',
  });

  const handleDeposit = async (token: 'base' | 'quote') => {
    const amount = token === 'base' ? amounts.depositBase : amounts.depositQuote;
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      // First approve, then deposit
      // The hooks now handle all notifications
      await approveToken(token, amount);
      await depositToken(token, amount);
      
      // Clear input
      setAmounts(prev => ({
        ...prev,
        [token === 'base' ? 'depositBase' : 'depositQuote']: ''
      }));
    } catch {
      // Error is already handled by the callbacks
    }
  };

  const handleWithdraw = async (token: 'base' | 'quote') => {
    const amount = token === 'base' ? amounts.withdrawBase : amounts.withdrawQuote;
    const balance = token === 'base' ? baseBalance : quoteBalance;
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(balance)) {
      toast.error('Insufficient balance');
      return;
    }

    try {
      // The hook now handles all notifications
      await withdrawToken(token, amount);
      
      // Clear input
      setAmounts(prev => ({
        ...prev,
        [token === 'base' ? 'withdrawBase' : 'withdrawQuote']: ''
      }));
    } catch {
      // Error is already handled by the callbacks
    }
  };

  if (!address) {
    return (
      <Card className="p-4">
        <p className="text-center text-muted-foreground">Connect wallet to deposit/withdraw</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Manage Balances</h3>
      
      {/* Current Balances */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">CLOB Balance (WETH)</span>
          <Badge variant="secondary" className="font-mono">{baseBalance}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">CLOB Balance (USDC)</span>
          <Badge variant="secondary" className="font-mono">{quoteBalance}</Badge>
        </div>
      </div>

      <Tabs defaultValue="deposit">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>
        
        <TabsContent value="deposit" className="space-y-4">
          {/* Deposit WETH */}
          <div className="space-y-2">
            <Label>Deposit WETH</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amounts.depositBase}
                onChange={(e) => setAmounts(prev => ({ ...prev, depositBase: e.target.value }))}
              />
              <Button 
                onClick={() => handleDeposit('base')}
                disabled={isLoading || !amounts.depositBase}
              >
                Deposit
              </Button>
            </div>
          </div>
          
          {/* Deposit USDC */}
          <div className="space-y-2">
            <Label>Deposit USDC</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amounts.depositQuote}
                onChange={(e) => setAmounts(prev => ({ ...prev, depositQuote: e.target.value }))}
              />
              <Button 
                onClick={() => handleDeposit('quote')}
                disabled={isLoading || !amounts.depositQuote}
              >
                Deposit
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="withdraw" className="space-y-4">
          {/* Withdraw WETH */}
          <div className="space-y-2">
            <Label>Withdraw WETH</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amounts.withdrawBase}
                onChange={(e) => setAmounts(prev => ({ ...prev, withdrawBase: e.target.value }))}
              />
              <Button 
                onClick={() => handleWithdraw('base')}
                disabled={isLoading || !amounts.withdrawBase}
                variant="outline"
              >
                Withdraw
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Available: {baseBalance} WETH</p>
          </div>
          
          {/* Withdraw USDC */}
          <div className="space-y-2">
            <Label>Withdraw USDC</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amounts.withdrawQuote}
                onChange={(e) => setAmounts(prev => ({ ...prev, withdrawQuote: e.target.value }))}
              />
              <Button 
                onClick={() => handleWithdraw('quote')}
                disabled={isLoading || !amounts.withdrawQuote}
                variant="outline"
              >
                Withdraw
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Available: {quoteBalance} USDC</p>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}