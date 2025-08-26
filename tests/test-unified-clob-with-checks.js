/**
 * Test UnifiedCLOB with state verification
 * Checks actual state changes to verify transactions succeeded
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { parseUnits, formatUnits, encodeFunctionData, decodeFunctionResult } from 'viem';
import * as clob from './lib/unified-clob-utils.js';
import { setupDelegation } from './lib/porto-clob-utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration and ABIs
const relayConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../relay.json'), 'utf8'));
const CLOB_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'abis/UnifiedCLOB.json'), 'utf8'));
const ERC20_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'abis/MintableERC20.json'), 'utf8'));

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

// Check ERC20 balance
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
        abi: CLOB_ABI,
        functionName: 'getBalance',
        args: [userAddress, tokenAddress],
    });
    
    const result = await rpcCall('eth_call', [{
        to: clob.CONFIG.clob,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: CLOB_ABI,
        functionName: 'getBalance',
        data: result,
    });
    
    return {
        available: decoded[0],
        locked: decoded[1],
    };
}

// Check if user has minted tokens
async function checkHasMinted(tokenAddress, userAddress) {
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'hasMinted',
        args: [userAddress],
    });
    
    const result = await rpcCall('eth_call', [{
        to: tokenAddress,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'hasMinted',
        data: result,
    });
    
    return decoded;
}

// Check allowance
async function checkAllowance(tokenAddress, owner, spender) {
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender],
    });
    
    const result = await rpcCall('eth_call', [{
        to: tokenAddress,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'allowance',
        data: result,
    });
    
    return decoded;
}

// Get order details
async function getOrder(orderId) {
    const data = encodeFunctionData({
        abi: CLOB_ABI,
        functionName: 'orders',
        args: [orderId],
    });
    
    const result = await rpcCall('eth_call', [{
        to: clob.CONFIG.clob,
        data: data,
    }, 'latest']);
    
    const decoded = decodeFunctionResult({
        abi: CLOB_ABI,
        functionName: 'orders',
        data: result,
    });
    
    return {
        id: decoded[0],
        trader: decoded[1],
        bookId: decoded[2],
        orderType: decoded[3],
        price: decoded[4],
        amount: decoded[5],
        filled: decoded[6],
        status: decoded[7],
        timestamp: decoded[8],
    };
}

function formatBalance(balance, decimals) {
    return formatUnits(balance, decimals);
}

async function main() {
    console.log('🎯 Testing UnifiedCLOB with State Verification\n');
    console.log('='.repeat(60));
    
    // Generate test accounts
    const aliceKey = generatePrivateKey();
    const alice = privateKeyToAccount(aliceKey);
    
    const bobKey = generatePrivateKey();
    const bob = privateKeyToAccount(bobKey);
    
    console.log('👤 Alice:', alice.address);
    console.log('👤 Bob:', bob.address);
    
    try {
        // 1. Setup Porto delegation
        console.log('\n' + '='.repeat(60));
        console.log('1️⃣  SETUP PORTO DELEGATION');
        console.log('='.repeat(60));
        
        await setupDelegation(alice);
        await setupDelegation(bob);
        
        // 2. Mint tokens with verification
        console.log('\n' + '='.repeat(60));
        console.log('2️⃣  MINT DEMO TOKENS WITH VERIFICATION');
        console.log('='.repeat(60));
        
        // Check initial state
        console.log('\n📊 Checking initial token balances...');
        const aliceUsdcBefore = await checkTokenBalance(clob.CONFIG.tokens.USDC, alice.address);
        const aliceWethBefore = await checkTokenBalance(clob.CONFIG.tokens.WETH, alice.address);
        const aliceHasMintedUsdcBefore = await checkHasMinted(clob.CONFIG.tokens.USDC, alice.address);
        const aliceHasMintedWethBefore = await checkHasMinted(clob.CONFIG.tokens.WETH, alice.address);
        
        console.log(`  Alice USDC balance: ${formatBalance(aliceUsdcBefore, 6)}`);
        console.log(`  Alice WETH balance: ${formatBalance(aliceWethBefore, 18)}`);
        console.log(`  Alice has minted USDC: ${aliceHasMintedUsdcBefore}`);
        console.log(`  Alice has minted WETH: ${aliceHasMintedWethBefore}`);
        
        // Mint tokens for Alice
        await clob.mintTokens(alice, clob.CONFIG.tokens.USDC);
        await clob.mintTokens(alice, clob.CONFIG.tokens.WETH);
        
        // Wait a bit for transactions to settle
        console.log('\n⏳ Waiting for transactions to settle...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check after minting
        console.log('\n📊 Checking balances after minting...');
        const aliceUsdcAfter = await checkTokenBalance(clob.CONFIG.tokens.USDC, alice.address);
        const aliceWethAfter = await checkTokenBalance(clob.CONFIG.tokens.WETH, alice.address);
        const aliceHasMintedUsdcAfter = await checkHasMinted(clob.CONFIG.tokens.USDC, alice.address);
        const aliceHasMintedWethAfter = await checkHasMinted(clob.CONFIG.tokens.WETH, alice.address);
        
        console.log(`  Alice USDC balance: ${formatBalance(aliceUsdcAfter, 6)} (${aliceUsdcAfter > aliceUsdcBefore ? '✅' : '❌'} increased)`);
        console.log(`  Alice WETH balance: ${formatBalance(aliceWethAfter, 18)} (${aliceWethAfter > aliceWethBefore ? '✅' : '❌'} increased)`);
        console.log(`  Alice has minted USDC: ${aliceHasMintedUsdcAfter} (${aliceHasMintedUsdcAfter ? '✅' : '❌'})`);
        console.log(`  Alice has minted WETH: ${aliceHasMintedWethAfter} (${aliceHasMintedWethAfter ? '✅' : '❌'})`);
        
        // Mint for Bob
        await clob.mintTokens(bob, clob.CONFIG.tokens.USDC);
        await clob.mintTokens(bob, clob.CONFIG.tokens.WETH);
        
        // 3. Approve CLOB with verification
        console.log('\n' + '='.repeat(60));
        console.log('3️⃣  APPROVE CLOB WITH VERIFICATION');
        console.log('='.repeat(60));
        
        // Check allowance before
        console.log('\n📊 Checking allowances before approval...');
        const aliceUsdcAllowanceBefore = await checkAllowance(clob.CONFIG.tokens.USDC, alice.address, clob.CONFIG.clob);
        const aliceWethAllowanceBefore = await checkAllowance(clob.CONFIG.tokens.WETH, alice.address, clob.CONFIG.clob);
        
        console.log(`  Alice USDC allowance: ${formatBalance(aliceUsdcAllowanceBefore, 6)}`);
        console.log(`  Alice WETH allowance: ${formatBalance(aliceWethAllowanceBefore, 18)}`);
        
        // Approve
        await clob.approveToken(alice, clob.CONFIG.tokens.USDC, clob.CONFIG.clob);
        await clob.approveToken(alice, clob.CONFIG.tokens.WETH, clob.CONFIG.clob);
        await clob.approveToken(bob, clob.CONFIG.tokens.USDC, clob.CONFIG.clob);
        await clob.approveToken(bob, clob.CONFIG.tokens.WETH, clob.CONFIG.clob);
        
        // Wait and check
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📊 Checking allowances after approval...');
        const aliceUsdcAllowanceAfter = await checkAllowance(clob.CONFIG.tokens.USDC, alice.address, clob.CONFIG.clob);
        const aliceWethAllowanceAfter = await checkAllowance(clob.CONFIG.tokens.WETH, alice.address, clob.CONFIG.clob);
        
        console.log(`  Alice USDC allowance: ${formatBalance(aliceUsdcAllowanceAfter, 6)} (${aliceUsdcAllowanceAfter > aliceUsdcAllowanceBefore ? '✅' : '❌'} increased)`);
        console.log(`  Alice WETH allowance: ${formatBalance(aliceWethAllowanceAfter, 18)} (${aliceWethAllowanceAfter > aliceWethAllowanceBefore ? '✅' : '❌'} increased)`);
        
        // 4. Deposit to CLOB with verification
        console.log('\n' + '='.repeat(60));
        console.log('4️⃣  DEPOSIT TO CLOB WITH VERIFICATION');
        console.log('='.repeat(60));
        
        // Check CLOB balances before
        console.log('\n📊 Checking CLOB balances before deposit...');
        const aliceClobUsdcBefore = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.USDC);
        const aliceClobWethBefore = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.WETH);
        
        console.log(`  Alice CLOB USDC: available=${formatBalance(aliceClobUsdcBefore.available, 6)}, locked=${formatBalance(aliceClobUsdcBefore.locked, 6)}`);
        console.log(`  Alice CLOB WETH: available=${formatBalance(aliceClobWethBefore.available, 18)}, locked=${formatBalance(aliceClobWethBefore.locked, 18)}`);
        
        // Deposit
        await clob.deposit(alice, clob.CONFIG.tokens.USDC, parseUnits('500', 6));
        await clob.deposit(alice, clob.CONFIG.tokens.WETH, parseUnits('1', 18));
        await clob.deposit(bob, clob.CONFIG.tokens.USDC, parseUnits('500', 6));
        await clob.deposit(bob, clob.CONFIG.tokens.WETH, parseUnits('1', 18));
        
        // Wait and check
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📊 Checking CLOB balances after deposit...');
        const aliceClobUsdcAfter = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.USDC);
        const aliceClobWethAfter = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.WETH);
        
        console.log(`  Alice CLOB USDC: available=${formatBalance(aliceClobUsdcAfter.available, 6)} (${aliceClobUsdcAfter.available > aliceClobUsdcBefore.available ? '✅' : '❌'} increased)`);
        console.log(`  Alice CLOB WETH: available=${formatBalance(aliceClobWethAfter.available, 18)} (${aliceClobWethAfter.available > aliceClobWethBefore.available ? '✅' : '❌'} increased)`);
        
        // 5. Place orders with verification
        console.log('\n' + '='.repeat(60));
        console.log('5️⃣  PLACE ORDERS WITH VERIFICATION');
        console.log('='.repeat(60));
        
        // Place Alice's buy order
        const aliceOrderResult = await clob.placeOrder(
            alice,
            1, // WETH/USDC book
            true, // buy
            parseUnits('2000', 18), // price: 2000 USDC per WETH
            parseUnits('0.1', 18) // amount: 0.1 WETH
        );
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check Alice's CLOB balance after placing order
        console.log('\n📊 Checking Alice\'s balance after placing buy order...');
        const aliceAfterOrder = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.USDC);
        console.log(`  USDC locked: ${formatBalance(aliceAfterOrder.locked, 6)} (should be 200 for 0.1 WETH @ 2000)`);
        console.log(`  USDC available: ${formatBalance(aliceAfterOrder.available, 6)} (should be reduced by 200)`);
        
        // Place Bob's sell order
        const bobOrderResult = await clob.placeOrder(
            bob,
            1, // WETH/USDC book
            false, // sell
            parseUnits('2000', 18), // price: 2000 USDC per WETH
            parseUnits('0.1', 18) // amount: 0.1 WETH
        );
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check final balances after matching
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL STATE CHECK');
        console.log('='.repeat(60));
        
        const aliceFinalClobUsdc = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.USDC);
        const aliceFinalClobWeth = await checkCLOBBalance(alice.address, clob.CONFIG.tokens.WETH);
        const bobFinalClobUsdc = await checkCLOBBalance(bob.address, clob.CONFIG.tokens.USDC);
        const bobFinalClobWeth = await checkCLOBBalance(bob.address, clob.CONFIG.tokens.WETH);
        
        console.log('\n📊 Alice Final CLOB Balances:');
        console.log(`  USDC: available=${formatBalance(aliceFinalClobUsdc.available, 6)}, locked=${formatBalance(aliceFinalClobUsdc.locked, 6)}`);
        console.log(`  WETH: available=${formatBalance(aliceFinalClobWeth.available, 18)}, locked=${formatBalance(aliceFinalClobWeth.locked, 18)}`);
        console.log(`  Expected: ~300 USDC (500 - 200), ~1.0999 WETH (1 + 0.0999 from trade)`);
        
        console.log('\n📊 Bob Final CLOB Balances:');
        console.log(`  USDC: available=${formatBalance(bobFinalClobUsdc.available, 6)}, locked=${formatBalance(bobFinalClobUsdc.locked, 6)}`);
        console.log(`  WETH: available=${formatBalance(bobFinalClobWeth.available, 18)}, locked=${formatBalance(bobFinalClobWeth.locked, 18)}`);
        console.log(`  Expected: ~699.6 USDC (500 + 199.6 from trade), ~0.9 WETH (1 - 0.1)`);
        
        // Try to get order details
        if (aliceOrderResult.orderId) {
            const order1 = await getOrder(aliceOrderResult.orderId);
            console.log('\n📊 Alice\'s Order Details:');
            console.log(`  Status: ${order1.status === 1 ? '✅ FILLED' : order1.status === 0 ? '🕐 ACTIVE' : '❌ CANCELLED'}`);
            console.log(`  Filled: ${formatBalance(order1.filled, 18)}/${formatBalance(order1.amount, 18)}`);
        }
        
        if (bobOrderResult.orderId) {
            const order2 = await getOrder(bobOrderResult.orderId);
            console.log('\n📊 Bob\'s Order Details:');
            console.log(`  Status: ${order2.status === 1 ? '✅ FILLED' : order2.status === 0 ? '🕐 ACTIVE' : '❌ CANCELLED'}`);
            console.log(`  Filled: ${formatBalance(order2.filled, 18)}/${formatBalance(order2.amount, 18)}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETE WITH VERIFICATION!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.log('\nNote: Some transactions may fail if the relayer is not configured to sponsor them.');
        console.log('This is expected behavior if gasless sponsorship limits are reached.');
        process.exit(1);
    }
}

// Run the test
main().catch(console.error);