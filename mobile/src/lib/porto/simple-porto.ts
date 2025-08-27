/**
 * Simple Porto Relay Functions for CLOB Mobile
 * Based on working rise-mobile-example implementation
 * Direct mappings to Porto relay API - no abstractions
 */

import { privateKeyToAccount, generatePrivateKey, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';
import { NETWORK_CONFIG, CONTRACTS } from '../../config/contracts';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../../config/constants';

// Configuration
export const PORTO_CONFIG = {
  relayUrl: NETWORK_CONFIG.portoRelayUrl || 'https://rise-testnet-porto.fly.dev',
  chainId: NETWORK_CONFIG.chainId,
  proxy: CONTRACTS.PortoDelegationProxy.address,
  orchestrator: CONTRACTS.PortoOrchestrator.address,
  ethAddress: '0x0000000000000000000000000000000000000000' as Address, // ETH for gasless
};

/**
 * Make a JSON-RPC call to Porto relay
 * Simple fetch without AbortController - matches working pattern
 */
export async function relayCall(method: string, params: any[]): Promise<any> {
  const requestId = Math.floor(Math.random() * 10000);
  
  console.log(`[Porto] Calling ${method}`, params);
  
  try {
    const response = await fetch(PORTO_CONFIG.relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      // Log the full error for debugging
      console.error(`[Porto] ${method} error:`, result.error);
      throw new Error(result.error.message || 'Relay call failed');
    }
    
    console.log(`[Porto] ${method} success:`, result.result);
    return result;
  } catch (error: any) {
    console.error(`[Porto] ${method} failed:`, error.message || error);
    throw error;
  }
}

/**
 * Serialize public key for Porto (pads address to 64 bytes)
 */
export function serializePublicKey(address: string): string {
  const cleanAddress = address.toLowerCase();
  if (cleanAddress.length < 66) {
    const withoutPrefix = cleanAddress.slice(2);
    const padded = withoutPrefix.padStart(64, '0');
    return '0x' + padded;
  }
  return cleanAddress;
}

/**
 * Check Porto health
 */
export async function checkHealth(): Promise<string> {
  const response = await relayCall('health', []);
  return response.result;
}

/**
 * Get wallet keys from Porto relay
 * This should be called before other wallet operations
 */
export async function getWalletKeys(address: Address): Promise<any> {
  try {
    const response = await relayCall('wallet_getKeys', [{
      address: address,
      chainId: `0x${PORTO_CONFIG.chainId.toString(16)}`, // Convert to hex
    }]);
    return response.result;
  } catch (error) {
    console.log('wallet_getKeys failed (expected for new accounts):', error);
    return null;
  }
}

/**
 * Check account delegation status using RPC call
 * More reliable than wallet_getAccountInfo
 */
export async function checkDelegationViaRPC(address: Address): Promise<boolean> {
  try {
    // Make RPC call to check if account has code (delegation)
    const response = await fetch(NETWORK_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [address, 'latest'],
        id: Date.now(),
      }),
    });
    
    const result = await response.json();
    // Account is delegated if it has code (not just '0x')
    return result.result && result.result !== '0x';
  } catch (error) {
    console.error('RPC delegation check failed:', error);
    return false;
  }
}

/**
 * Check account info (delegation status)
 * First tries wallet_getKeys, then falls back to RPC check
 */
export async function getAccountInfo(address: Address): Promise<{
  isDelegated: boolean;
  delegationAddress?: Address;
  keys?: any;
}> {
  try {
    // First try to get wallet keys - this is the most reliable check for Porto delegation
    const keys = await getWalletKeys(address);
    
    // IMPORTANT: Empty array means no keys = not delegated
    // Only consider delegated if we have actual keys
    if (keys && Array.isArray(keys) && keys.length > 0) {
      return {
        isDelegated: true,
        delegationAddress: PORTO_CONFIG.proxy,
        keys,
      };
    }
    
    // If wallet_getKeys returned empty array or null, account is NOT delegated
    // Don't fall back to RPC check as it can give false positives with Porto
    console.log('[Porto] No delegation keys found - account needs delegation setup');
    return {
      isDelegated: false,
      delegationAddress: undefined,
      keys: keys || [],
    };
  } catch (error) {
    console.error('Failed to get account info:', error);
    // Default to not delegated if we can't check
    return { isDelegated: false };
  }
}

/**
 * Prepare account delegation (EIP-7702)
 * This sets up the delegation that will be deployed on first transaction
 */
export async function prepareUpgradeAccount(
  account: PrivateKeyAccount,
  sessionKey?: PrivateKeyAccount
): Promise<{
  digests: { auth: Hex; exec: Hex };
  context: any;
}> {
  const params = {
    address: account.address,
    delegation: PORTO_CONFIG.proxy,
    capabilities: {
      authorizeKeys: sessionKey ? [{
        expiry: '0x0', // Never expires for demo
        prehash: false,
        publicKey: serializePublicKey(sessionKey.address),
        role: 'session',
        type: 'secp256k1',
        permissions: []
      }] : []
    },
    chainId: PORTO_CONFIG.chainId
  };

  const response = await relayCall('wallet_prepareUpgradeAccount', [params]);
  return response.result;
}

/**
 * Store account delegation in relay
 */
export async function upgradeAccount(
  account: PrivateKeyAccount,
  prepareResponse: any
): Promise<void> {
  // Sign the digests
  const authSig = await account.sign({ hash: prepareResponse.digests.auth });
  const execSig = await account.sign({ hash: prepareResponse.digests.exec });

  await relayCall('wallet_upgradeAccount', [{
    context: prepareResponse.context,
    signatures: { auth: authSig, exec: execSig }
  }]);
}

/**
 * Setup delegation for account (combines prepare and upgrade)
 */
export async function setupDelegation(account: PrivateKeyAccount): Promise<boolean> {
  try {
    console.log('[Porto] Setting up delegation for:', account.address);
    
    // Check if already delegated (with better error handling)
    const accountInfo = await getAccountInfo(account.address);
    if (accountInfo.isDelegated) {
      console.log('[Porto] Account already delegated');
      return true;
    }

    // Step 1: Prepare delegation
    console.log('[Porto] Step 1: Preparing delegation with proxy:', PORTO_CONFIG.proxy);
    const prepareResponse = await prepareUpgradeAccount(account);
    
    if (!prepareResponse || !prepareResponse.digests) {
      throw new Error('Invalid prepare response');
    }
    
    console.log('[Porto] Auth digest:', prepareResponse.digests.auth.substring(0, 20) + '...');
    console.log('[Porto] Exec digest:', prepareResponse.digests.exec.substring(0, 20) + '...');
    
    // Step 2: Store delegation signatures in relay
    console.log('[Porto] Step 2: Storing delegation signatures...');
    await upgradeAccount(account, prepareResponse);
    
    console.log('[Porto] ✅ Delegation stored in relay');
    
    // IMPORTANT: Delegation is now stored but won't show in wallet_getKeys until first transaction
    // The first transaction will include the delegation deployment as a preCall
    // We mark this as successful since the signatures are stored
    console.log('[Porto] Delegation setup complete - will be deployed on first transaction');
    
    // Store a flag that delegation has been setup but not yet deployed
    // This prevents the app from trying to set it up again
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.HAS_DELEGATED, 'true');
    } catch (e) {
      // SecureStore might not be available in all environments
    }
    
    return true;
  } catch (error: any) {
    console.error('[Porto] Failed to setup delegation:', error.message || error);
    return false;
  }
}

/**
 * Prepare transaction calls
 */
export async function prepareCalls(
  account: PrivateKeyAccount,
  calls: Array<{ to: Address | string; data: Hex; value: Hex }>
): Promise<{
  digest: Hex;
  context: any;
}> {
  // Make sure addresses are lowercase for Porto
  const formattedCalls = calls.map(call => ({
    ...call,
    to: call.to.toLowerCase() as Address
  }));
  
  const params = {
    from: account.address,
    chainId: PORTO_CONFIG.chainId,
    calls: formattedCalls,
    capabilities: {
      meta: {
        feeToken: PORTO_CONFIG.ethAddress // For gasless
      }
    }
  };

  // Include key in the request
  const response = await relayCall('wallet_prepareCalls', [{
    ...params,
    key: {
      prehash: false,
      publicKey: serializePublicKey(account.address),
      type: 'secp256k1'
    }
  }]);
  return response.result;
}

/**
 * Send prepared calls to relay
 */
export async function sendPreparedCalls(
  account: PrivateKeyAccount,
  prepareResult: any
): Promise<{ id: string }> {
  const signature = await account.sign({ hash: prepareResult.digest });

  const response = await relayCall('wallet_sendPreparedCalls', [{
    context: prepareResult.context,
    key: {
      prehash: false,
      publicKey: serializePublicKey(account.address),
      type: 'secp256k1'
    },
    signature
  }]);
  
  // response.result should have the bundle ID
  if (typeof response.result === 'string') {
    return { id: response.result };
  }
  return response.result;
}

/**
 * Get transaction status
 */
export async function getCallsStatus(bundleId: string): Promise<any> {
  const response = await relayCall('wallet_getCallsStatus', [bundleId]);
  return response.result;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  bundleId: string,
  maxAttempts: number = 30
): Promise<any> {
  let attempts = 0;
  
  console.log(`[Porto] Waiting for transaction ${bundleId}...`);
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const status = await getCallsStatus(bundleId);
      
      // Check for success status
      if (status.status === 200 || status.status === 'success') {
        console.log(`[Porto] Transaction confirmed:`, bundleId);
        return status;
      }
      
      // Check for failed status
      if (status.status === 'failed' || status.receipts?.[0]?.status === '0x0') {
        console.error(`[Porto] Transaction failed:`, bundleId);
        throw new Error('Transaction failed');
      }
    } catch (error) {
      // Status might not be available yet, continue waiting
      if (attempts > 5) {
        console.log(`[Porto] Still waiting for ${bundleId}... (attempt ${attempts})`);
      }
    }
    
    attempts++;
  }
  
  throw new Error('Transaction timeout after ' + (maxAttempts * 2) + ' seconds');
}

/**
 * Complete flow: Send transaction (delegation will be setup on first tx if needed)
 */
export async function sendTransaction(
  account: PrivateKeyAccount,
  to: Address,
  data: Hex,
  value: Hex = '0x0'
): Promise<{ bundleId: string; status: any }> {
  console.log(`[Porto] Sending transaction to ${to}`);
  
  // Prepare the transaction
  const prepareResult = await prepareCalls(account, [{
    to,
    data,
    value
  }]);

  // Check if delegation will be deployed
  const preCallCount = prepareResult.context?.quote?.intent?.encodedPreCalls?.length || 0;
  if (preCallCount > 0) {
    console.log(`[Porto] Transaction will deploy delegation + execute call`);
  }

  // Send it
  const sendResult = await sendPreparedCalls(account, prepareResult);
  const bundleId = sendResult.id || sendResult;

  console.log(`[Porto] Transaction sent with bundle ID: ${bundleId}`);

  // Wait for confirmation
  const status = await waitForTransaction(bundleId);

  return {
    bundleId,
    status
  };
}

/**
 * Helper: Generate a new account
 */
export function generateAccount(): PrivateKeyAccount {
  const privateKey = generatePrivateKey();
  return privateKeyToAccount(privateKey);
}

/**
 * Helper: Create account from private key
 */
export function createAccount(privateKey: Hex): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}