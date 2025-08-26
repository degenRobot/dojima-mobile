'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createContractHook } from '@/hooks/useContractFactory';

// Create contract hooks for the mock tokens
const useBaseToken = createContractHook('WETH');
const useQuoteToken = createContractHook('USDC');

export function TokenFaucet() {
  // Use contract hooks
  const { write: writeBase, isLoading: isLoadingBase } = useBaseToken();
  const { write: writeQuote, isLoading: isLoadingQuote } = useQuoteToken();

  const handleFaucetBase = async () => {
    try {
      await writeBase('faucet', []);
      toast.success('Test WETH received!');
    } catch {
      // Faucet error handled by toast in contract hook
    }
  };

  const handleFaucetQuote = async () => {
    try {
      await writeQuote('faucet', []);
      toast.success('Test USDC received!');
    } catch {
      // Faucet error handled by toast in contract hook
    }
  };

  // Show success messages when transactions complete
  useEffect(() => {
    // Success messages are handled in the write functions via toast
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Faucet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Get test tokens for trading on the testnet
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={handleFaucetBase}
            disabled={isLoadingBase}
            variant="outline"
          >
            {isLoadingBase ? 'Getting...' : 'Get Test WETH'}
          </Button>
          
          <Button
            onClick={handleFaucetQuote}
            disabled={isLoadingQuote}
            variant="outline"
          >
            {isLoadingQuote ? 'Getting...' : 'Get Test USDC'}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Each faucet request gives you 1000 tokens
        </p>
      </CardContent>
    </Card>
  );
}