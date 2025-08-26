/**
 * Porto CLOB Utilities
 * Based on the working rise-mobile-example implementation
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { encodeFunctionData, parseUnits, formatUnits } from 'viem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load relay configuration
const relayConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../relay.json'), 'utf8'));

export const CONFIG = {
    relayUrl: relayConfig.porto.relayUrl,
    chainId: relayConfig.network.chainId,
    rpcUrl: relayConfig.network.rpcUrl,
    delegationProxy: relayConfig.porto.delegationProxy,
    orchestrator: relayConfig.porto.orchestrator,
    contracts: relayConfig.contracts,
    ethAddress: '0x0000000000000000000000000000000000000000',
};

// CLOB ABI fragments
export const CLOB_ABI = {
    placeLimitOrder: {
        name: 'placeLimitOrder',
        type: 'function',
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'amountA', type: 'uint256' },
            { name: 'amountB', type: 'uint256' },
            { name: 'isBuy', type: 'bool' },
        ],
    },
    placeMarketOrder: {
        name: 'placeMarketOrder',
        type: 'function',
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'isBuy', type: 'bool' },
        ],
    },
    cancelOrder: {
        name: 'cancelOrder',
        type: 'function',
        inputs: [
            { name: 'orderId', type: 'uint256' },
        ],
    },
};

// ERC20 ABI fragments
export const ERC20_ABI = {
    approve: {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
    },
    balanceOf: {
        name: 'balanceOf',
        type: 'function',
        inputs: [
            { name: 'account', type: 'address' },
        ],
        outputs: [
            { name: '', type: 'uint256' },
        ],
    },
};

/**
 * Make a JSON-RPC call to Porto relay (matches working example)
 */
export async function makeRelayCall(method, params) {
    console.log(`\n📡 Calling ${method}...`);
    
    const response = await fetch(CONFIG.relayUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: Date.now(),
        }),
    });

    const result = await response.json();
    
    if (result.error) {
        console.error(`❌ RPC Error: ${result.error.message}`);
        throw new Error(`RPC Error: ${result.error.message}`);
    }
    
    return result.result;
}

/**
 * Serialize public key for Porto (pads address to 64 bytes)
 */
export function serializePublicKey(address) {
    const cleanAddress = address.toLowerCase();
    if (cleanAddress.length < 66) {
        const withoutPrefix = cleanAddress.slice(2);
        const padded = withoutPrefix.padStart(64, '0');
        return '0x' + padded;
    }
    return cleanAddress;
}

/**
 * Setup delegation for a new account (matches working example)
 */
export async function setupDelegation(account, sessionKey = null) {
    console.log('\n🔐 Setting up Porto delegation...');
    
    // Prepare upgrade with optional session key
    const prepareParams = {
        address: account.address,
        delegation: CONFIG.delegationProxy,
        capabilities: {
            authorizeKeys: sessionKey ? [{
                expiry: '0x0',
                prehash: false,
                publicKey: serializePublicKey(sessionKey.address),
                role: 'session',
                type: 'secp256k1',
                permissions: []
            }] : []
        },
        chainId: CONFIG.chainId
    };
    
    console.log('  Delegation proxy:', CONFIG.delegationProxy);
    const prepareResponse = await makeRelayCall('wallet_prepareUpgradeAccount', [prepareParams]);
    
    // Sign digests
    const authSig = await account.sign({ hash: prepareResponse.digests.auth });
    const execSig = await account.sign({ hash: prepareResponse.digests.exec });
    
    // Store upgrade in relay
    await makeRelayCall('wallet_upgradeAccount', [{
        context: prepareResponse.context,
        signatures: { auth: authSig, exec: execSig }
    }]);
    
    console.log('✅ Delegation setup complete');
    return prepareResponse;
}

/**
 * Prepare calls (matches working example with key parameter)
 */
export async function prepareCalls(account, calls) {
    const params = {
        from: account.address,
        chainId: CONFIG.chainId,
        calls: calls,
        capabilities: {
            meta: {
                feeToken: CONFIG.ethAddress // ETH for gasless
            }
        }
    };
    
    // Include key in the request like the working example
    const response = await makeRelayCall('wallet_prepareCalls', [{
        ...params,
        key: {
            prehash: false,
            publicKey: serializePublicKey(account.address),
            type: 'secp256k1'
        }
    }]);
    
    return response;
}

/**
 * Send prepared calls (matches working example)
 */
export async function sendPreparedCalls(account, prepareResult) {
    const signature = await account.sign({ hash: prepareResult.digest });
    
    const response = await makeRelayCall('wallet_sendPreparedCalls', [{
        context: prepareResult.context,
        key: {
            prehash: false,
            publicKey: serializePublicKey(account.address),
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

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(bundleId, maxAttempts = 30) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            const status = await makeRelayCall('wallet_getCallsStatus', [bundleId]);
            
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

/**
 * Execute a gasless transaction (simplified version matching working example)
 */
export async function executeGaslessTransaction(account, target, data, value = '0x0') {
    console.log('\n💸 Executing gasless transaction...');
    console.log('  Target:', target);
    console.log('  Value:', value.toString());
    
    // Prepare the calls
    const prepareResult = await prepareCalls(account, [{
        to: target,
        data: data,
        value: typeof value === 'bigint' ? '0x' + value.toString(16) : value
    }]);
    
    console.log('  Digest:', prepareResult.digest.substring(0, 20) + '...');
    
    // Send the prepared calls
    const sendResult = await sendPreparedCalls(account, prepareResult);
    console.log('✅ Transaction submitted:', sendResult.id);
    
    // Wait for confirmation (optional)
    try {
        const status = await waitForTransaction(sendResult.id, 5); // Quick check
        if (status.receipts?.[0]) {
            console.log('  Status:', status.receipts[0].status === '0x1' ? '✅ Success' : '❌ Failed');
        }
    } catch (e) {
        console.log('  Transaction pending...');
    }
    
    return { hash: sendResult.id, bundleId: sendResult.id };
}

/**
 * Complete transaction flow (matches working example)
 */
export async function sendTransaction(account, to, data, value = '0x0') {
    // Prepare the transaction
    const prepareResult = await prepareCalls(account, [{
        to,
        data,
        value
    }]);
    
    // Send it
    const sendResult = await sendPreparedCalls(account, prepareResult);
    
    // Wait for confirmation
    const status = await waitForTransaction(sendResult.id);
    
    return {
        bundleId: sendResult.id,
        status
    };
}

/**
 * Encode functions for CLOB
 */
export function encodeLimitOrder(tokenA, tokenB, amountA, amountB, isBuy) {
    return encodeFunctionData({
        abi: [CLOB_ABI.placeLimitOrder],
        functionName: 'placeLimitOrder',
        args: [
            tokenA.toLowerCase(), // Ensure lowercase for viem
            tokenB.toLowerCase(), // Ensure lowercase for viem
            amountA, 
            amountB, 
            isBuy
        ],
    });
}

export function encodeMarketOrder(tokenA, tokenB, amount, isBuy) {
    return encodeFunctionData({
        abi: [CLOB_ABI.placeMarketOrder],
        functionName: 'placeMarketOrder',
        args: [
            tokenA.toLowerCase(), // Ensure lowercase for viem
            tokenB.toLowerCase(), // Ensure lowercase for viem
            amount, 
            isBuy
        ],
    });
}

export function encodeCancelOrder(orderId) {
    return encodeFunctionData({
        abi: [CLOB_ABI.cancelOrder],
        functionName: 'cancelOrder',
        args: [orderId],
    });
}

export function encodeApproval(spender, amount) {
    return encodeFunctionData({
        abi: [ERC20_ABI.approve],
        functionName: 'approve',
        args: [spender.toLowerCase(), amount], // Ensure lowercase for viem
    });
}

/**
 * Helper functions for CLOB operations
 */
export async function placeLimitOrder(account, baseToken, quoteToken, baseAmount, price, isBuy) {
    console.log('\n📊 Placing limit order...');
    console.log(`  ${isBuy ? 'BUY' : 'SELL'} ${formatUnits(baseAmount, 18)} @ ${formatUnits(price, 18)}`);
    
    // Calculate quote amount based on price
    const quoteAmount = (baseAmount * price) / parseUnits('1', 18);
    
    // Encode the order
    const data = encodeLimitOrder(baseToken, quoteToken, baseAmount, quoteAmount, isBuy);
    
    // Execute gasless
    return await executeGaslessTransaction(
        account,
        CONFIG.contracts.clob.EnhancedSpotBook,
        data
    );
}

export async function placeMarketOrder(account, baseToken, quoteToken, amount, isBuy) {
    console.log('\n📊 Placing market order...');
    console.log(`  ${isBuy ? 'BUY' : 'SELL'} ${formatUnits(amount, 18)}`);
    
    // Encode the order
    const data = encodeMarketOrder(baseToken, quoteToken, amount, isBuy);
    
    // Execute gasless
    return await executeGaslessTransaction(
        account,
        CONFIG.contracts.clob.EnhancedSpotBook,
        data
    );
}

export async function approveToken(account, tokenAddress, amount = parseUnits('1000000', 18)) {
    console.log('\n✅ Approving token...');
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Amount: ${formatUnits(amount, 18)}`);
    
    const data = encodeApproval(CONFIG.contracts.clob.EnhancedSpotBook, amount);
    
    return await executeGaslessTransaction(account, tokenAddress, data);
}

/**
 * Create a test account
 */
export async function createTestAccount(name = 'Test') {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    console.log(`\n🔑 Created ${name} Account:`);
    console.log('  Address:', account.address);
    console.log('  Private Key:', privateKey);
    
    return { privateKey, account };
}