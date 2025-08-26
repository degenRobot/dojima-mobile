import { toast } from '@/lib/toast-manager';
import { formatUnits } from 'viem';

export interface TransactionMetadata {
  action?: string; // e.g., "Place Order", "Deposit", "Withdraw"
  details?: Record<string, unknown>; // Additional context-specific data
}

export interface TransactionCallbacks {
  onTxSending?: (metadata?: TransactionMetadata) => void;
  onTxSent?: (txHash: string, metadata?: TransactionMetadata) => void;
  onTxConfirmed?: (receipt: {
    status: number | string | boolean;
    gasUsed?: string | number | bigint;
    transactionHash?: string;
  }, metadata?: TransactionMetadata) => void;
  onTxError?: (error: Error, metadata?: TransactionMetadata) => void;
}

// Default implementations for transaction callbacks
export const defaultTransactionCallbacks: TransactionCallbacks = {
  onTxSending: (metadata) => {
    const action = metadata?.action || 'Transaction';
    const details = metadata?.details || {};
    
    let message = `Preparing ${action}...`;
    
    // Add context-specific details
    if (details.side && details.price && details.amount) {
      // Order placement
      message = `Preparing ${details.side} order: ${details.amount} at $${details.price}`;
    } else if (details.token && details.amount) {
      // Deposit/Withdraw
      message = `Preparing ${action}: ${details.amount} ${details.token}`;
    } else if (details.token && details.spender) {
      // Approval
      message = `Preparing approval for ${details.token}`;
    }
    
    toast.info(message, {
      autoClose: 3000,
      position: 'bottom-right' as const
    });
  },
  
  onTxSent: (txHash, metadata) => {
    const action = metadata?.action || 'Transaction';
    const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
    
    toast.info(
      `${action} sent! Hash: ${shortHash}`,
      {
        autoClose: 4000,
        position: 'bottom-right' as const
      }
    );
  },
  
  onTxConfirmed: (receipt, metadata) => {
    const action = metadata?.action || 'Transaction';
    const details = metadata?.details || {};
    
    // Handle different status formats from various clients
    const success = receipt.status === 1 || 
                   receipt.status === '0x1' || 
                   receipt.status === 'success' || 
                   receipt.status === true ||
                   (typeof receipt.status === 'string' && parseInt(receipt.status, 16) === 1);
    
    if (success) {
      let message = `${action} confirmed!`;
      
      // Add context-specific success details
      if (details.side && details.price && details.amount) {
        // Order placement
        message = `${details.side} order placed: ${details.amount} at $${details.price}`;
      } else if (details.token && details.amount) {
        // Deposit/Withdraw
        message = `${action} successful: ${details.amount} ${details.token}`;
      }
      
      // Add gas used info
      const gasUsed = receipt.gasUsed ? formatUnits(BigInt(receipt.gasUsed), 9) : null;
      if (gasUsed) {
        message += ` (Gas: ${Number(gasUsed).toFixed(6)} ETH)`;
      }
      
      toast.success(message, {
        autoClose: 5000,
        position: 'bottom-right' as const
      });
    } else {
      toast.error(`${action} failed!`, {
        autoClose: 5000,
        position: 'bottom-right' as const
      });
    }
  },
  
  onTxError: (error, metadata) => {
    const action = metadata?.action || 'Transaction';
    
    // Parse error message
    let errorMessage = error.message;
    if (errorMessage.includes('User denied') || errorMessage.includes('rejected')) {
      errorMessage = 'Transaction cancelled by user';
    } else if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for transaction';
    } else if (errorMessage.includes('nonce')) {
      errorMessage = 'Transaction nonce conflict - please refresh and try again';
    }
    
    toast.error(
      `${action} failed: ${errorMessage}`,
      {
        autoClose: 7000,
        position: 'bottom-right' as const
      }
    );
  }
};

// Helper to create callbacks with custom metadata
export function createTransactionCallbacks(
  metadata: TransactionMetadata,
  customCallbacks?: Partial<TransactionCallbacks>
): TransactionCallbacks {
  return {
    onTxSending: customCallbacks?.onTxSending || ((m) => defaultTransactionCallbacks.onTxSending?.({ ...metadata, ...m })),
    onTxSent: customCallbacks?.onTxSent || ((hash, m) => defaultTransactionCallbacks.onTxSent?.(hash, { ...metadata, ...m })),
    onTxConfirmed: customCallbacks?.onTxConfirmed || ((receipt, m) => defaultTransactionCallbacks.onTxConfirmed?.(receipt, { ...metadata, ...m })),
    onTxError: customCallbacks?.onTxError || ((error, m) => defaultTransactionCallbacks.onTxError?.(error, { ...metadata, ...m }))
  };
}