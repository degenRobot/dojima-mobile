// Porto client for interacting with the Porto relay
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

  // Make a JSON-RPC call to the Porto relay
  private async makeRelayCall(method: string, params: any[]): Promise<any> {
    try {
      const response = await fetch(`${this.config.relayUrl}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      const data: RelayResponse = await response.json();

      if (data.error) {
        throw new Error(`Relay error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      console.error(`Failed to call ${method}:`, error);
      throw error;
    }
  }

  // Serialize public key for Porto
  private serializePublicKey(address: string): string {
    // Remove 0x prefix and pad to 64 bytes (32 bytes for x, 32 bytes for y)
    const cleanAddress = address.toLowerCase().replace('0x', '');
    // For EOA addresses, we pad with the address itself (simplified for demo)
    return '0x' + cleanAddress.padStart(64, '0') + cleanAddress.padStart(64, '0');
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

  // Setup delegation for gasless transactions
  async setupDelegation(userAddress: string, sessionAccount: Account): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('Setting up delegation for:', userAddress);

      // Step 1: Prepare upgrade with admin key
      const prepareParams = {
        address: userAddress,
        delegation: '0xc46F88d3bfe039A0aA31E1eC2D4ccB3a4D4112FF', // Porto Proxy address
        capabilities: {
          authorizeKeys: [
            {
              prehash: false,
              expiry: '0x0',
              publicKey: this.serializePublicKey(sessionAccount.address),
              role: 'admin',
              type: 'secp256k1',
              permissions: [],
            },
          ],
        },
        chainId: this.config.chainId,
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
      const upgradeResponse = await this.makeRelayCall('wallet_upgradeAccount', [{
        context: prepareResponse.context,
        signatures: { 
          auth: authSig, 
          exec: execSig 
        },
      }]);

      console.log('Delegation setup complete:', upgradeResponse);

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

  // Execute a gasless transaction
  async executeGaslessTransaction(params: {
    from: string;
    target: string;
    data: string;
    value?: bigint;
    sessionKey: Account;
  }): Promise<any> {
    try {
      // Prepare intent
      const intentParams = {
        sender: params.from,
        capabilities: {
          calls: [
            {
              to: params.target,
              data: params.data,
              value: (params.value || 0n).toString(),
            },
          ],
          meta: {
            feeToken: '0x0000000000000000000000000000000000000000', // ETH
          },
        },
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        nonce: Date.now(), // Simple nonce for demo
        chainId: `0x${this.config.chainId.toString(16)}`,
      };

      const prepareResponse = await this.makeRelayCall('wallet_prepareIntent', [intentParams]);

      if (!prepareResponse?.hash) {
        throw new Error('Failed to prepare intent');
      }

      // Sign intent with session key
      const signature = await params.sessionKey.sign({
        hash: prepareResponse.hash as `0x${string}`,
      });

      // Submit intent
      const submitResponse = await this.makeRelayCall('wallet_submitIntent', [{
        intent: prepareResponse.intent,
        signature,
      }]);

      return submitResponse;
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

  // Get intent status
  async getIntentStatus(intentHash: string): Promise<any> {
    return this.makeRelayCall('wallet_getIntentStatus', [{
      hash: intentHash,
      chainId: `0x${this.config.chainId.toString(16)}`,
    }]);
  }
}