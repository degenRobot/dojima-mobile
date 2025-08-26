// Porto client for interacting with the Porto relay
// Based on the working rise-mobile-example implementation
import { Account } from 'viem';

interface PortoConfig {
  relayUrl: string;
  chainId: number;
  rpcUrl: string;
}

interface RelayResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class PortoClient {
  private config: PortoConfig;

  constructor(config: PortoConfig) {
    this.config = config;
  }

  // Make a JSON-RPC call to the Porto relay (matches working example)
  private async makeRelayCall(method: string, params: any[]): Promise<any> {
    try {
      const requestId = Math.floor(Math.random() * 10000);
      
      const response = await fetch(this.config.relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: requestId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Relay error: ${result.error.message}`);
      }

      return result.result;
    } catch (error) {
      console.error(`Failed to call ${method}:`, error);
      throw error;
    }
  }

  // Serialize public key for Porto (matches working example)
  private serializePublicKey(address: string): string {
    const cleanAddress = address.toLowerCase();
    if (cleanAddress.length < 66) {
      const withoutPrefix = cleanAddress.slice(2);
      const padded = withoutPrefix.padStart(64, '0');
      return '0x' + padded;
    }
    return cleanAddress;
  }

  // Check Porto health
  async checkHealth(): Promise<string> {
    return await this.makeRelayCall('health', []);
  }

  // Check delegation status
  async checkDelegationStatus(address: string): Promise<{
    isDelegated: boolean;
    isPending: boolean;
    delegationAddress?: string;
  }> {
    try {
      // Check account status
      const accountInfo = await this.makeRelayCall('wallet_getAccount', [{
        address,
        chainId: `0x${this.config.chainId.toString(16)}`,
      }]);

      return {
        isDelegated: accountInfo?.isDelegated || false,
        isPending: accountInfo?.isPending || false,
        delegationAddress: accountInfo?.delegationAddress,
      };
    } catch (error) {
      console.error('Failed to check delegation status:', error);
      return {
        isDelegated: false,
        isPending: false,
      };
    }
  }

  // Setup delegation for gasless transactions (matches working example)
  async setupDelegation(userAddress: string, sessionAccount: Account): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('Setting up delegation for:', userAddress);

      // Step 1: Prepare upgrade with session key
      const prepareParams = {
        address: userAddress,
        delegation: '0x894C14A66508D221A219Dd0064b4A6718d0AAA52', // Updated delegation proxy
        capabilities: {
          authorizeKeys: sessionAccount ? [{
            expiry: '0x0', // Never expires for demo
            prehash: false,
            publicKey: this.serializePublicKey(sessionAccount.address),
            role: 'session',
            type: 'secp256k1',
            permissions: []
          }] : []
        },
        chainId: this.config.chainId
      };

      const prepareResponse = await this.makeRelayCall('wallet_prepareUpgradeAccount', [prepareParams]);
      
      if (!prepareResponse?.digests) {
        throw new Error('Failed to prepare upgrade');
      }

      console.log('Prepared upgrade, signing digests...');

      // Step 2: Sign digests with session account
      const authSig = await sessionAccount.sign({ 
        hash: prepareResponse.digests.auth as `0x${string}` 
      });
      const execSig = await sessionAccount.sign({ 
        hash: prepareResponse.digests.exec as `0x${string}` 
      });

      // Step 3: Store upgrade in relay database
      await this.makeRelayCall('wallet_upgradeAccount', [{
        context: prepareResponse.context,
        signatures: { 
          auth: authSig, 
          exec: execSig 
        },
      }]);

      console.log('Delegation setup complete');

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to setup delegation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Prepare calls (matches working example with key parameter)
  async prepareCalls(account: Account, calls: Array<{ to: string; data: string; value: string }>): Promise<any> {
    // Format calls with lowercase addresses
    const formattedCalls = calls.map(call => ({
      ...call,
      to: call.to.toLowerCase()
    }));
    
    const params = {
      from: account.address,
      chainId: this.config.chainId,
      calls: formattedCalls,
      capabilities: {
        meta: {
          feeToken: '0x0000000000000000000000000000000000000000' // ETH for gasless
        }
      }
    };

    // Include key in the request like the working example
    const response = await this.makeRelayCall('wallet_prepareCalls', [{
      ...params,
      key: {
        prehash: false,
        publicKey: this.serializePublicKey(account.address),
        type: 'secp256k1'
      }
    }]);
    
    return response;
  }

  // Send prepared calls (matches working example)
  async sendPreparedCalls(account: Account, prepareResult: any): Promise<{ id: string }> {
    const signature = await account.sign({ hash: prepareResult.digest });

    const response = await this.makeRelayCall('wallet_sendPreparedCalls', [{
      context: prepareResult.context,
      key: {
        prehash: false,
        publicKey: this.serializePublicKey(account.address),
        type: 'secp256k1'
      },
      signature
    }]);
    
    // Return standardized format
    if (typeof response === 'string') {
      return { id: response };
    }
    return response;
  }

  // Get transaction status
  async getCallsStatus(bundleId: string): Promise<any> {
    return await this.makeRelayCall('wallet_getCallsStatus', [bundleId]);
  }

  // Wait for transaction confirmation
  async waitForTransaction(bundleId: string, maxAttempts: number = 30): Promise<any> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const status = await this.getCallsStatus(bundleId);
        
        if (status.status === 200 || status.status === 'success') {
          return status;
        }
      } catch (e) {
        // Continue waiting
      }
      
      attempts++;
    }
    
    throw new Error('Transaction timeout');
  }

  // Execute a gasless transaction (complete flow matching working example)
  async executeGaslessTransaction(params: {
    from: string;
    target: string;
    data: string;
    value?: bigint;
    sessionKey: Account;
  }): Promise<any> {
    try {
      // Prepare the calls
      const prepareResult = await this.prepareCalls(params.sessionKey, [{
        to: params.target,
        data: params.data,
        value: params.value ? '0x' + params.value.toString(16) : '0x0'
      }]);

      if (!prepareResult?.digest) {
        throw new Error('Failed to prepare calls');
      }

      // Send the prepared calls
      const sendResult = await this.sendPreparedCalls(params.sessionKey, prepareResult);

      // Optionally wait for quick confirmation
      try {
        const status = await this.waitForTransaction(sendResult.id, 3);
        return {
          hash: sendResult.id,
          bundleId: sendResult.id,
          status: status.receipts?.[0]?.status === '0x1' ? 'success' : 'pending'
        };
      } catch {
        // Transaction still pending
        return {
          hash: sendResult.id,
          bundleId: sendResult.id,
          status: 'pending'
        };
      }
    } catch (error) {
      console.error('Failed to execute gasless transaction:', error);
      throw error;
    }
  }

  // Get account information
  async getAccountInfo(address: string): Promise<any> {
    return this.makeRelayCall('wallet_getAccount', [{
      address,
      chainId: `0x${this.config.chainId.toString(16)}`,
    }]);
  }
}