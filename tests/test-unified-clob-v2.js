/**
 * Test UnifiedCLOBV2 with separate order placement and matching
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { parseUnits, formatUnits, encodeFunctionData, decodeFunctionResult, decodeEventLog } from 'viem';
import { setupDelegation, executeGaslessTransaction, waitForTransaction } from './lib/porto-clob-utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration and ABIs
const relayConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../relay.json'), 'utf8'));
const CLOBV2_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'abis/UnifiedCLOBV2.json'), 'utf8'));
const ERC20_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'abis/MintableERC20.json'), 'utf8'));

// Contract addresses (from latest deployment)
const CONFIG = {
    clob: '0x92025983Ab5641378893C3932A1a43e214e7446D',
    tokens: {
        USDC: '0xaE3A504B9Fe27cf2ff3Ed3e36bE037AD36a1a48a',
        WETH: '0x3Af2aed9FFA29b2a0e387a2Fb45a540A66f4D2b4',
        WBTC: '0x30301403f92915c8731880eF595c20C8C6059369'
    },
    books: {
        WETH_USDC: 1,
        WBTC_USDC: 2
    },
    decimals: {
        USDC: 6,
        WETH: 18,
        WBTC: 8
    }
};

// Helper to make RPC calls
async function rpcCall(method, params) {
    const response = await fetch(relayConfig.network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: Date.now(),
        }),
    });
    
    const result = await response.json();
    if (result.error) throw new Error(result.error.message);
    return result.result;
}

// Check token balance
async function checkTokenBalance(tokenAddress, userAddress) {
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
    });
    
    const result = await rpcCall('eth_call', [{
        to: tokenAddress,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        data: result,
    });
    
    return decoded;
}

// Check CLOB balance
async function checkCLOBBalance(userAddress, tokenAddress) {
    const data = encodeFunctionData({
        abi: CLOBV2_ABI,
        functionName: 'getBalance',
        args: [userAddress, tokenAddress],
    });
    
    const result = await rpcCall('eth_call', [{
        to: CONFIG.clob,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: CLOBV2_ABI,
        functionName: 'getBalance',
        data: result,
    });
    
    return {
        available: decoded[0],
        locked: decoded[1],
    };
}

// Get order book
async function getOrderBook(bookId) {
    const data = encodeFunctionData({
        abi: CLOBV2_ABI,
        functionName: 'getOrderBook',
        args: [BigInt(bookId)],
    });
    
    const result = await rpcCall('eth_call', [{
        to: CONFIG.clob,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: CLOBV2_ABI,
        functionName: 'getOrderBook',
        data: result,
    });
    
    return {
        buyOrders: decoded[0],
        sellOrders: decoded[1],
    };
}

// Get order details
async function getOrder(orderId) {
    const data = encodeFunctionData({
        abi: CLOBV2_ABI,
        functionName: 'getOrder',
        args: [BigInt(orderId)],
    });
    
    const result = await rpcCall('eth_call', [{
        to: CONFIG.clob,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: CLOBV2_ABI,
        functionName: 'getOrder',
        data: result,
    });
    
    // Return structured order object
    const order = decoded[0];
    return {
        id: order[0],
        trader: order[1],
        bookId: order[2],
        orderType: order[3],
        price: order[4],
        amount: order[5],
        filled: order[6],
        status: order[7],
        timestamp: order[8]
    };
}

// Mint tokens
async function mintTokens(account, tokenAddress) {
    console.log('\n💰 Minting tokens...');
    
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'mintOnce',
        args: [],
    });
    
    return await executeGaslessTransaction(account, tokenAddress, data);
}

// Approve token
async function approveToken(account, tokenAddress, spenderAddress, amount) {
    console.log('\n✅ Approving token...');
    
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
    });
    
    return await executeGaslessTransaction(account, tokenAddress, data);
}

// Deposit to CLOB
async function depositToCLOB(account, tokenAddress, amount) {
    console.log('\n📥 Depositing to CLOB...');
    console.log(`  Amount: ${formatUnits(amount, CONFIG.decimals[Object.keys(CONFIG.tokens).find(k => CONFIG.tokens[k] === tokenAddress)])}`);
    
    const data = encodeFunctionData({
        abi: CLOBV2_ABI,
        functionName: 'deposit',
        args: [tokenAddress, amount],
    });
    
    return await executeGaslessTransaction(account, CONFIG.clob, data);
}

// Place order (no auto-matching in V2)
async function placeOrder(account, bookId, isBuy, price, amount) {
    console.log(`\n📝 Placing ${isBuy ? 'BUY' : 'SELL'} order...`);
    console.log(`  Book: ${bookId}`);
    console.log(`  Price: ${formatUnits(price, 6)}`); // Price in USDC
    console.log(`  Amount: ${formatUnits(amount, 18)}`); // Amount normalized to 18 decimals
    
    const data = encodeFunctionData({
        abi: CLOBV2_ABI,
        functionName: 'placeOrder',
        args: [
            BigInt(bookId),
            isBuy ? 0 : 1, // OrderType enum
            price,
            amount,
        ],
    });
    
    const result = await executeGaslessTransaction(account, CONFIG.clob, data);
    
    // Parse events to get order ID
    if (result.logs && result.logs.length > 0) {
        for (const log of result.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: CLOBV2_ABI,
                    data: log.data,
                    topics: log.topics,
                });
                
                if (decoded.eventName === 'OrderPlaced') {
                    console.log(`  ✅ Order placed with ID: ${decoded.args.orderId}`);
                    return decoded.args.orderId;
                }
            } catch (e) {
                // Not the event we're looking for
            }
        }
    }
    
    return null;
}

// Match orders manually
async function matchOrders(account, bookId, maxMatches = 10) {
    console.log('\n🔄 Matching orders...');
    console.log(`  Book: ${bookId}`);
    console.log(`  Max matches: ${maxMatches}`);
    
    const data = encodeFunctionData({
        abi: CLOBV2_ABI,
        functionName: 'matchOrders',
        args: [BigInt(bookId), BigInt(maxMatches)],
    });
    
    const result = await executeGaslessTransaction(account, CONFIG.clob, data);
    
    // Parse matching events
    let matchCount = 0;
    if (result.logs && result.logs.length > 0) {
        for (const log of result.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: CLOBV2_ABI,
                    data: log.data,
                    topics: log.topics,
                });
                
                if (decoded.eventName === 'OrderMatched') {
                    matchCount++;
                    console.log(`  ✅ Matched orders ${decoded.args.buyOrderId} and ${decoded.args.sellOrderId}`);
                    console.log(`     Price: ${formatUnits(decoded.args.price, 6)} USDC`);
                    console.log(`     Amount: ${formatUnits(decoded.args.amount, 18)}`);
                }
            } catch (e) {
                // Not the event we're looking for
            }
        }
    }
    
    console.log(`  Total matches: ${matchCount}`);
    return matchCount;
}

// Main test function
async function testUnifiedCLOBV2() {
    console.log('=====================================');
    console.log('Testing UnifiedCLOBV2 with Porto');
    console.log('=====================================');
    
    // Generate test accounts
    const alice = privateKeyToAccount(generatePrivateKey());
    const bob = privateKeyToAccount(generatePrivateKey());
    
    console.log('\n👤 Alice:', alice.address);
    console.log('👤 Bob:', bob.address);
    
    try {
        // Setup Porto delegation for both accounts
        console.log('\n🔐 Setting up Porto delegation...');
        await setupDelegation(alice);
        await setupDelegation(bob);
        console.log('  ✅ Delegation setup complete');
        
        // Mint tokens for both users
        console.log('\n💰 Minting tokens for Alice...');
        await mintTokens(alice, CONFIG.tokens.USDC);
        await mintTokens(alice, CONFIG.tokens.WETH);
        
        console.log('\n💰 Minting tokens for Bob...');
        await mintTokens(bob, CONFIG.tokens.USDC);
        await mintTokens(bob, CONFIG.tokens.WETH);
        
        // Check balances
        const aliceUSDC = await checkTokenBalance(CONFIG.tokens.USDC, alice.address);
        const aliceWETH = await checkTokenBalance(CONFIG.tokens.WETH, alice.address);
        console.log('\n📊 Alice token balances:');
        console.log(`  USDC: ${formatUnits(aliceUSDC, 6)}`);
        console.log(`  WETH: ${formatUnits(aliceWETH, 18)}`);
        
        const bobUSDC = await checkTokenBalance(CONFIG.tokens.USDC, bob.address);
        const bobWETH = await checkTokenBalance(CONFIG.tokens.WETH, bob.address);
        console.log('\n📊 Bob token balances:');
        console.log(`  USDC: ${formatUnits(bobUSDC, 6)}`);
        console.log(`  WETH: ${formatUnits(bobWETH, 18)}`);
        
        // Approve tokens
        console.log('\n✅ Alice approving tokens...');
        await approveToken(alice, CONFIG.tokens.USDC, CONFIG.clob, parseUnits('1000000', 6));
        await approveToken(alice, CONFIG.tokens.WETH, CONFIG.clob, parseUnits('1000', 18));
        
        console.log('\n✅ Bob approving tokens...');
        await approveToken(bob, CONFIG.tokens.USDC, CONFIG.clob, parseUnits('1000000', 6));
        await approveToken(bob, CONFIG.tokens.WETH, CONFIG.clob, parseUnits('1000', 18));
        
        // Deposit to CLOB
        console.log('\n📥 Alice depositing to CLOB...');
        await depositToCLOB(alice, CONFIG.tokens.USDC, parseUnits('500', 6));
        await depositToCLOB(alice, CONFIG.tokens.WETH, parseUnits('5', 18));
        
        console.log('\n📥 Bob depositing to CLOB...');
        await depositToCLOB(bob, CONFIG.tokens.USDC, parseUnits('500', 6));
        await depositToCLOB(bob, CONFIG.tokens.WETH, parseUnits('5', 18));
        
        // Check CLOB balances
        const aliceCLOBUSDC = await checkCLOBBalance(alice.address, CONFIG.tokens.USDC);
        const aliceCLOBWETH = await checkCLOBBalance(alice.address, CONFIG.tokens.WETH);
        console.log('\n📊 Alice CLOB balances:');
        console.log(`  USDC: ${formatUnits(aliceCLOBUSDC.available, 6)} available, ${formatUnits(aliceCLOBUSDC.locked, 6)} locked`);
        console.log(`  WETH: ${formatUnits(aliceCLOBWETH.available, 18)} available, ${formatUnits(aliceCLOBWETH.locked, 18)} locked`);
        
        // Place orders (no auto-matching in V2)
        console.log('\n📈 Testing order placement without auto-matching...');
        
        // Alice places buy order for 0.1 WETH at 2000 USDC
        const aliceOrderId = await placeOrder(
            alice,
            CONFIG.books.WETH_USDC,
            true, // buy
            parseUnits('2000', 6), // price in USDC decimals
            parseUnits('0.1', 18)  // amount normalized to 18 decimals
        );
        
        // Bob places sell order for 0.1 WETH at 1900 USDC (crossable)
        const bobOrderId = await placeOrder(
            bob,
            CONFIG.books.WETH_USDC,
            false, // sell
            parseUnits('1900', 6), // price in USDC decimals
            parseUnits('0.1', 18)  // amount normalized to 18 decimals
        );
        
        // Check order book before matching
        console.log('\n📖 Order book before matching:');
        const bookBefore = await getOrderBook(CONFIG.books.WETH_USDC);
        console.log(`  Buy orders: ${bookBefore.buyOrders.length}`);
        console.log(`  Sell orders: ${bookBefore.sellOrders.length}`);
        
        // Check individual orders
        if (aliceOrderId) {
            const aliceOrder = await getOrder(aliceOrderId);
            console.log('\n📝 Alice\'s order:');
            console.log(`  Status: ${['ACTIVE', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'][aliceOrder.status]}`);
            console.log(`  Filled: ${formatUnits(aliceOrder.filled, 18)} / ${formatUnits(aliceOrder.amount, 18)}`);
        }
        
        if (bobOrderId) {
            const bobOrder = await getOrder(bobOrderId);
            console.log('\n📝 Bob\'s order:');
            console.log(`  Status: ${['ACTIVE', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'][bobOrder.status]}`);
            console.log(`  Filled: ${formatUnits(bobOrder.filled, 18)} / ${formatUnits(bobOrder.amount, 18)}`);
        }
        
        // Now match orders manually
        console.log('\n🔄 Calling matchOrders to execute trades...');
        const matchCount = await matchOrders(alice, CONFIG.books.WETH_USDC);
        
        // Check order book after matching
        console.log('\n📖 Order book after matching:');
        const bookAfter = await getOrderBook(CONFIG.books.WETH_USDC);
        console.log(`  Buy orders: ${bookAfter.buyOrders.length}`);
        console.log(`  Sell orders: ${bookAfter.sellOrders.length}`);
        
        // Check orders after matching
        if (aliceOrderId) {
            const aliceOrder = await getOrder(aliceOrderId);
            console.log('\n📝 Alice\'s order after matching:');
            console.log(`  Status: ${['ACTIVE', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'][aliceOrder.status]}`);
            console.log(`  Filled: ${formatUnits(aliceOrder.filled, 18)} / ${formatUnits(aliceOrder.amount, 18)}`);
        }
        
        if (bobOrderId) {
            const bobOrder = await getOrder(bobOrderId);
            console.log('\n📝 Bob\'s order after matching:');
            console.log(`  Status: ${['ACTIVE', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'][bobOrder.status]}`);
            console.log(`  Filled: ${formatUnits(bobOrder.filled, 18)} / ${formatUnits(bobOrder.amount, 18)}`);
        }
        
        // Check final CLOB balances
        const finalAliceCLOBUSDC = await checkCLOBBalance(alice.address, CONFIG.tokens.USDC);
        const finalAliceCLOBWETH = await checkCLOBBalance(alice.address, CONFIG.tokens.WETH);
        console.log('\n📊 Alice final CLOB balances:');
        console.log(`  USDC: ${formatUnits(finalAliceCLOBUSDC.available, 6)} available, ${formatUnits(finalAliceCLOBUSDC.locked, 6)} locked`);
        console.log(`  WETH: ${formatUnits(finalAliceCLOBWETH.available, 18)} available, ${formatUnits(finalAliceCLOBWETH.locked, 18)} locked`);
        
        const finalBobCLOBUSDC = await checkCLOBBalance(bob.address, CONFIG.tokens.USDC);
        const finalBobCLOBWETH = await checkCLOBBalance(bob.address, CONFIG.tokens.WETH);
        console.log('\n📊 Bob final CLOB balances:');
        console.log(`  USDC: ${formatUnits(finalBobCLOBUSDC.available, 6)} available, ${formatUnits(finalBobCLOBUSDC.locked, 6)} locked`);
        console.log(`  WETH: ${formatUnits(finalBobCLOBWETH.available, 18)} available, ${formatUnits(finalBobCLOBWETH.locked, 18)} locked`);
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testUnifiedCLOBV2().catch(console.error);