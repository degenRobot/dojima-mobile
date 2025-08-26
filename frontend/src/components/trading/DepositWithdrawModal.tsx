'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSimpleCLOB } from '@/hooks/useSimpleCLOB';
import { useAccount } from 'wagmi';
import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { contracts } from '@/contracts/contracts';
import { parseUnits, formatUnits } from 'viem';

interface DepositWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'deposit' | 'withdraw';
  defaultToken?: 'WETH' | 'USDC';
}

export function DepositWithdrawModal({ 
  isOpen, 
  onClose, 
  defaultTab = 'deposit',
  defaultToken = 'USDC'
}: DepositWithdrawModalProps) {
  const { address } = useAccount();
  const { 
    baseBalance, 
    quoteBalance, 
    approveToken, 
    depositToken, 
    withdrawToken
  } = useSimpleCLOB();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedToken, setSelectedToken] = useState<'WETH' | 'USDC'>(defaultToken);
  const [amount, setAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Token configurations
  const tokens = {
    WETH: {
      address: contracts.WETH.address,
      decimals: 18,
      balance: baseBalance,
      symbol: 'WETH',
    },
    USDC: {
      address: contracts.USDC.address,
      decimals: 6,
      balance: quoteBalance,
      symbol: 'USDC',
    },
  };

  const currentToken = tokens[selectedToken];

  // Check allowance for deposits
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: currentToken.address as Address,
    abi: contracts[selectedToken].abi,
    functionName: 'allowance',
    args: address ? [address, contracts.EnhancedSpotBook.address] : undefined,
    query: {
      enabled: activeTab === 'deposit' && !!address,
    },
  });

  // Check wallet balance for deposits
  const { data: walletBalance } = useReadContract({
    address: currentToken.address as Address,
    abi: contracts[selectedToken].abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: activeTab === 'deposit' && !!address,
    },
  });

  // Check if approval is needed
  useEffect(() => {
    if (activeTab === 'deposit' && amount && allowance !== undefined) {
      const amountBigInt = parseUnits(amount || '0', currentToken.decimals);
      setNeedsApproval((allowance as bigint) < amountBigInt);
    }
  }, [amount, allowance, activeTab, currentToken.decimals]);

  const handleApprove = async () => {
    if (!amount) return;
    
    setIsApproving(true);
    try {
      await approveToken(selectedToken === 'WETH' ? 'base' : 'quote', amount);
      // Success notification handled by the hook
      await refetchAllowance();
      setNeedsApproval(false);
    } catch {
      // Error notification handled by the hook
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    if (!amount) return;
    
    setIsProcessing(true);
    try {
      await depositToken(selectedToken === 'WETH' ? 'base' : 'quote', amount);
      // Success notification handled by the hook
      setAmount('');
      onClose();
    } catch {
      // Error notification handled by the hook
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount) return;
    
    setIsProcessing(true);
    try {
      await withdrawToken(selectedToken === 'WETH' ? 'base' : 'quote', amount);
      // Success notification handled by the hook
      setAmount('');
      onClose();
    } catch {
      // Error notification handled by the hook
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMaxClick = () => {
    if (activeTab === 'deposit') {
      // Use wallet balance for deposits
      const balance = walletBalance ? formatUnits(walletBalance as bigint, currentToken.decimals) : '0';
      setAmount(balance);
    } else {
      // Use CLOB balance for withdrawals
      setAmount(currentToken.balance);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Funds</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'deposit' | 'withdraw')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="flex gap-2">
                <Button
                  variant={selectedToken === 'WETH' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedToken('WETH')}
                  className="flex-1"
                >
                  WETH
                </Button>
                <Button
                  variant={selectedToken === 'USDC' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedToken('USDC')}
                  className="flex-1"
                >
                  USDC
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Amount</Label>
                <span className="text-sm text-muted-foreground">
                  Wallet: {walletBalance ? formatUnits(walletBalance as bigint, currentToken.decimals) : '0'} {selectedToken}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isApproving || isProcessing}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleMaxClick}
                  disabled={isApproving || isProcessing}
                >
                  Max
                </Button>
              </div>
            </div>

            {needsApproval ? (
              <Button 
                className="w-full" 
                onClick={handleApprove}
                disabled={isApproving || !amount || parseFloat(amount) <= 0}
              >
                {isApproving ? 'Approving...' : `Approve ${selectedToken}`}
              </Button>
            ) : (
              <Button 
                className="w-full" 
                onClick={handleDeposit}
                disabled={isProcessing || !amount || parseFloat(amount) <= 0}
              >
                {isProcessing ? 'Depositing...' : 'Deposit'}
              </Button>
            )}

            <div className="text-sm text-muted-foreground">
              <p>CLOB Balance: {currentToken.balance} {selectedToken}</p>
            </div>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="flex gap-2">
                <Button
                  variant={selectedToken === 'WETH' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedToken('WETH')}
                  className="flex-1"
                >
                  WETH
                </Button>
                <Button
                  variant={selectedToken === 'USDC' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedToken('USDC')}
                  className="flex-1"
                >
                  USDC
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Amount</Label>
                <span className="text-sm text-muted-foreground">
                  Available: {currentToken.balance} {selectedToken}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isProcessing}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleMaxClick}
                  disabled={isProcessing}
                >
                  Max
                </Button>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleWithdraw}
              disabled={
                isProcessing || 
                !amount || 
                parseFloat(amount) <= 0 ||
                parseFloat(amount) > parseFloat(currentToken.balance)
              }
            >
              {isProcessing ? 'Withdrawing...' : 'Withdraw'}
            </Button>

            {parseFloat(amount) > parseFloat(currentToken.balance) && (
              <p className="text-sm text-red-500">
                Insufficient balance
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}