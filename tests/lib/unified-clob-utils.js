/**
 * Unified CLOB Test Utilities
 * Updated to work with UnifiedCLOB contract
 */
import { privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, parseUnits, formatUnits, decodeEventLog, decodeAbiParameters } from 'viem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeRelayCall, setupDelegation, executeGaslessTransaction, waitForTransaction } from './porto-clob-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration and ABIs
const relayConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../relay.json'), 'utf8'));
const CLOB_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../abis/UnifiedCLOB.json'), 'utf8'));
const ERC20_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../abis/MintableERC20.json'), 'utf8'));

export const CONFIG = {
    clob: relayConfig.contracts.clob.UnifiedCLOB,
    tokens: relayConfig.contracts.tokens,
    books: relayConfig.tradingBooks,
};

/**
 * Token operations
 */
export async function mintTokens(account, tokenAddress) {
    console.log('\n💰 Minting tokens...');
    
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'mintOnce',
        args: [],
    });
    
    return await executeGaslessTransaction(account, tokenAddress, data);
}

export async function approveToken(account, tokenAddress, spenderAddress, amount = parseUnits('1000000', 18)) {
    console.log('\n✅ Approving token...');
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Spender: ${spenderAddress}`);
    console.log(`  Amount: ${formatUnits(amount, 18)}`);
    
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
    });
    
    return await executeGaslessTransaction(account, tokenAddress, data);
}

/**
 * CLOB operations
 */
export async function deposit(account, tokenAddress, amount) {
    console.log('\n💵 Depositing to CLOB...');
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Amount: ${formatUnits(amount, 18)}`);
    
    const data = encodeFunctionData({
        abi: CLOB_ABI,
        functionName: 'deposit',
        args: [tokenAddress, amount],
    });
    
    return await executeGaslessTransaction(account, CONFIG.clob, data);
}

export async function withdraw(account, tokenAddress, amount) {
    console.log('\n💸 Withdrawing from CLOB...');
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Amount: ${formatUnits(amount, 18)}`);
    
    const data = encodeFunctionData({
        abi: CLOB_ABI,
        functionName: 'withdraw',
        args: [tokenAddress, amount],
    });
    
    return await executeGaslessTransaction(account, CONFIG.clob, data);
}

export async function placeOrder(account, bookId, isBuy, price, amount) {
    console.log('\n📊 Placing order...');
    console.log(`  Book: ${CONFIG.books[bookId - 1]?.symbol || bookId}`);
    console.log(`  Type: ${isBuy ? 'BUY' : 'SELL'}`);
    console.log(`  Price: ${formatUnits(price, 18)}`);
    console.log(`  Amount: ${formatUnits(amount, 18)}`);
    
    const orderType = isBuy ? 0 : 1; // 0 = BUY, 1 = SELL
    
    const data = encodeFunctionData({
        abi: CLOB_ABI,
        functionName: 'placeOrder',
        args: [bookId, orderType, price, amount],
    });
    
    const result = await executeGaslessTransaction(account, CONFIG.clob, data);
    
    // Try to decode the OrderPlaced event
    try {
        const receipt = await waitForTransaction(result.bundleId, 10);
        if (receipt?.receipts?.[0]?.logs) {
            for (const log of receipt.receipts[0].logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: CLOB_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'OrderPlaced') {
                        console.log(`  Order ID: ${decoded.args.orderId}`);
                        return { ...result, orderId: decoded.args.orderId };
                    }
                } catch (e) {
                    // Not the event we're looking for
                }
            }
        }
    } catch (e) {
        // Transaction might still be pending
    }
    
    return result;
}

export async function cancelOrder(account, orderId) {
    console.log('\n❌ Cancelling order...');
    console.log(`  Order ID: ${orderId}`);
    
    const data = encodeFunctionData({
        abi: CLOB_ABI,
        functionName: 'cancelOrder',
        args: [orderId],
    });
    
    return await executeGaslessTransaction(account, CONFIG.clob, data);
}

/**
 * View functions (these need RPC calls, not Porto)
 */
export async function getBalance(userAddress, tokenAddress) {
    const response = await fetch(relayConfig.network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
                to: CONFIG.clob,
                data: encodeFunctionData({
                    abi: CLOB_ABI,
                    functionName: 'getBalance',
                    args: [userAddress, tokenAddress],
                }),
            }, 'latest'],
            id: Date.now(),
        }),
    });
    
    const result = await response.json();
    if (result.error) throw new Error(result.error.message);
    
    // Decode the result (returns available and locked)
    const decoded = decodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }],
        result.result
    );
    
    return {
        available: decoded[0],
        locked: decoded[1],
    };
}

export async function getOrderBook(bookId) {
    const response = await fetch(relayConfig.network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
                to: CONFIG.clob,
                data: encodeFunctionData({
                    abi: CLOB_ABI,
                    functionName: 'getOrderBook',
                    args: [bookId],
                }),
            }, 'latest'],
            id: Date.now(),
        }),
    });
    
    const result = await response.json();
    if (result.error) throw new Error(result.error.message);
    
    // Decode the result (returns buy and sell order arrays)
    const decoded = decodeAbiParameters(
        [{ type: 'uint256[]' }, { type: 'uint256[]' }],
        result.result
    );
    
    return {
        buyOrders: decoded[0],
        sellOrders: decoded[1],
    };
}


/**
 * Demo flow functions
 */
export async function setupAndMintTokens(account) {
    console.log('\n🚀 Setting up account and minting tokens...');
    
    // Mint tokens
    await mintTokens(account, CONFIG.tokens.USDC);
    await mintTokens(account, CONFIG.tokens.WETH);
    await mintTokens(account, CONFIG.tokens.WBTC);
    
    // Approve CLOB to spend tokens
    await approveToken(account, CONFIG.tokens.USDC, CONFIG.clob);
    await approveToken(account, CONFIG.tokens.WETH, CONFIG.clob);
    await approveToken(account, CONFIG.tokens.WBTC, CONFIG.clob);
    
    console.log('✅ Setup complete!');
}

export async function depositToClob(account) {
    console.log('\n💰 Depositing tokens to CLOB...');
    
    // Deposit some tokens
    await deposit(account, CONFIG.tokens.USDC, parseUnits('500', 6)); // 500 USDC
    await deposit(account, CONFIG.tokens.WETH, parseUnits('1', 18)); // 1 WETH
    await deposit(account, CONFIG.tokens.WBTC, parseUnits('0.1', 8)); // 0.1 WBTC
    
    console.log('✅ Deposits complete!');
}

// Re-export Porto utils
export { setupDelegation, executeGaslessTransaction } from './porto-clob-utils.js';