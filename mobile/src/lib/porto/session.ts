// Session wallet for managing gasless transactions
import { Account } from 'viem';
import { PortoClient } from './client';

interface SessionWalletConfig {
  sessionKey: `0x${string}`;
  account: Account;
  portoClient: PortoClient;
}

interface TransactionRequest {
  target: string;
  data: string;
  value?: bigint;
}

export class SessionWallet {
  private sessionKey: `0x${string}`;
  public account: Account;
  private portoClient: PortoClient;
  private nonce: number = 0;

  constructor(config: SessionWalletConfig) {
    this.sessionKey = config.sessionKey;
    this.account = config.account;
    this.portoClient = config.portoClient;
  }

  // Get the current nonce
  private getNextNonce(): number {
    return Date.now() + this.nonce++;
  }

  // Execute a transaction through Porto
  async executeTransaction(request: TransactionRequest): Promise<{
    success: boolean;
    hash?: string;
    error?: string;
  }> {
    try {
      const result = await this.portoClient.executeGaslessTransaction({
        from: this.account.address,
        target: request.target,
        data: request.data,
        value: request.value,
        sessionKey: this.account,
      });

      if (result.hash) {
        return {
          success: true,
          hash: result.hash,
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed',
        };
      }
    } catch (error) {
      console.error('Transaction execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Sign a message
  async signMessage(message: string): Promise<string> {
    return this.account.signMessage({ message });
  }

  // Sign typed data
  async signTypedData(typedData: any): Promise<string> {
    return this.account.signTypedData(typedData);
  }

  // Get session address
  getAddress(): string {
    return this.account.address;
  }

  // Check if session is valid
  async isValid(): Promise<boolean> {
    try {
      const accountInfo = await this.portoClient.getAccountInfo(this.account.address);
      return accountInfo?.isActive || false;
    } catch (error) {
      console.error('Failed to check session validity:', error);
      return false;
    }
  }

  // Refresh session
  async refresh(): Promise<boolean> {
    try {
      // Re-check delegation status and re-authorize if needed
      const status = await this.portoClient.checkDelegationStatus(this.account.address);
      
      if (!status.isDelegated) {
        const result = await this.portoClient.setupDelegation(
          this.account.address,
          this.account
        );
        return result.success;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  }
}