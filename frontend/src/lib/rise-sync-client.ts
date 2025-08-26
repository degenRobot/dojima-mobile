import { createPublicShredClient } from 'shreds/viem';
import { createWalletClient, http, formatEther, parseGwei, type WalletClient, type Account, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { riseTestnet } from 'viem/chains';
import { RISE_RPC_URL } from '@/config/websocket';
import { NonceManager } from './wallet/NonceManager';
import { getPublicClientSingleton } from '@/providers/PublicClientProvider';

type SyncClient = ReturnType<typeof createPublicShredClient>;

export class RiseSyncClient {
  private syncClient: SyncClient;
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private account: Account;
  private nonceManager: NonceManager;
  private initialized = false;

  constructor(privateKey: string) {
    // Create account from private key
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Create sync client for sending transactions
    this.syncClient = createPublicShredClient({
      chain: riseTestnet,
      transport: http(RISE_RPC_URL),
    });
    
    // Create wallet client for signing transactions
    this.walletClient = createWalletClient({
      account: this.account,
      chain: riseTestnet,
      transport: http(RISE_RPC_URL),
    });
    
    // Use the singleton public client for reading blockchain data
    this.publicClient = getPublicClientSingleton();
    
    this.nonceManager = new NonceManager(this.publicClient, this.account.address);
    
    // Initialize nonce manager in background
    this.initialize();
  }

  private async initialize() {
    if (!this.initialized) {
      await this.nonceManager.initialize();
      this.initialized = true;
    }
  }

  async sendTransaction(tx: {
    to: string;
    data?: string;
    value?: string;
    gasLimit?: string;
  }) {
    try {
      
      // Get nonce from the nonce manager
      const nonce = await this.nonceManager.getNonce();
      
      // Build transaction parameters
      // Increased default gas limit to handle CLOB operations with hooks
      const defaultGas = 500000n;
      
      const baseParams = {
        account: this.account,
        chain: riseTestnet,
        to: tx.to as `0x${string}`,
        data: (tx.data || '0x') as `0x${string}`,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : defaultGas,
        gasPrice: parseGwei('0.001'),
        nonce: nonce,
      };

      // Prepare the transaction request with or without value
      const request = tx.value && BigInt(tx.value) > 0n
        ? await this.walletClient.prepareTransactionRequest({
            ...baseParams,
            value: BigInt(tx.value),
          })
        : await this.walletClient.prepareTransactionRequest(baseParams);
      
      // Sign the transaction
      const serializedTransaction = await this.walletClient.signTransaction(request);
      
      // Send using sync method for instant confirmation
      const receipt = await this.syncClient.sendRawTransactionSync({
        serializedTransaction
      });
      
      // Mark transaction as complete
      await this.nonceManager.onTransactionComplete(true);
      
      // Convert receipt to match expected format
      // The shreds client might return status in different formats
      let status: number;
      
      // Check various possible status formats
      const receiptStatus = receipt.status as string | number | boolean;
      if (receiptStatus === 'success' || receiptStatus === true) {
        status = 1;
      } else if (receiptStatus === 'failed' || receiptStatus === false) {
        status = 0;
      } else if (typeof receiptStatus === 'string') {
        // Handle hex string status (e.g., '0x1' or '0x0')
        status = parseInt(receiptStatus, 16);
      } else if (typeof receiptStatus === 'number') {
        status = receiptStatus;
      } else {
        // Default to success if status is undefined (transaction went through)
        status = 1;
      }
      
      return {
        ...receipt,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber?.toString() || '0',
        gasUsed: receipt.gasUsed?.toString() || '0',
        status: status,
      };
    } catch (error) {
      
      // Mark transaction as failed
      await this.nonceManager.onTransactionComplete(false);
      
      // Enhanced error handling with user-friendly messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle specific error cases
      if (errorMessage.includes('insufficient funds')) {
        const balance = await this.publicClient.getBalance({ address: this.account.address });
        throw new Error(
          `Insufficient funds. Current balance: ${formatEther(balance)} ETH. ` +
          `Please add funds to ${this.account.address}`
        );
      }
      
      if (errorMessage.includes('nonce too low')) {
        const currentNonce = await this.publicClient.getTransactionCount({ 
          address: this.account.address 
        });
        throw new Error(
          `Transaction nonce conflict. Expected nonce: ${currentNonce}. ` +
          `Please refresh the page and try again.`
        );
      }
      
      if (errorMessage.includes('gas required exceeds')) {
        throw new Error(
          'Transaction would fail. The contract execution requires more gas than provided. ' +
          'This usually means the transaction would revert.'
        );
      }
      
      if (errorMessage.includes('User denied') || errorMessage.includes('rejected')) {
        throw new Error('Transaction was cancelled by the user.');
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        throw new Error(
          'Transaction timed out. The network may be congested. Please try again.'
        );
      }
      
      
      // Re-throw with more context
      throw new Error(`Transaction failed: ${errorMessage}`);
    }
  }

  async getBalance() {
    const balance = await this.syncClient.getBalance({
      address: this.account.address,
    });
    return formatEther(balance);
  }

  getAddress() {
    return this.account.address;
  }

  cleanup() {
    this.nonceManager.stopPolling();
  }
}