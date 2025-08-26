/**
 * Test UnifiedCLOB with Porto gasless transactions
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { parseUnits } from 'viem';
import * as clob from './lib/unified-clob-utils.js';
import { setupDelegation } from './lib/porto-clob-utils.js';

async function main() {
    console.log('🎯 Testing UnifiedCLOB with Porto Gasless Transactions\n');
    console.log('='.repeat(60));
    
    // Generate test accounts
    const aliceKey = generatePrivateKey();
    const alice = privateKeyToAccount(aliceKey);
    
    const bobKey = generatePrivateKey();
    const bob = privateKeyToAccount(bobKey);
    
    console.log('👤 Alice:', alice.address);
    console.log('👤 Bob:', bob.address);
    
    try {
        // 1. Setup Porto delegation for both accounts
        console.log('\n' + '='.repeat(60));
        console.log('1️⃣  SETUP PORTO DELEGATION');
        console.log('='.repeat(60));
        
        await setupDelegation(alice);
        await setupDelegation(bob);
        
        // 2. Mint tokens
        console.log('\n' + '='.repeat(60));
        console.log('2️⃣  MINT DEMO TOKENS');
        console.log('='.repeat(60));
        
        await clob.mintTokens(alice, clob.CONFIG.tokens.USDC);
        await clob.mintTokens(alice, clob.CONFIG.tokens.WETH);
        
        await clob.mintTokens(bob, clob.CONFIG.tokens.USDC);
        await clob.mintTokens(bob, clob.CONFIG.tokens.WETH);
        
        // 3. Approve CLOB
        console.log('\n' + '='.repeat(60));
        console.log('3️⃣  APPROVE CLOB');
        console.log('='.repeat(60));
        
        await clob.approveToken(alice, clob.CONFIG.tokens.USDC, clob.CONFIG.clob);
        await clob.approveToken(alice, clob.CONFIG.tokens.WETH, clob.CONFIG.clob);
        
        await clob.approveToken(bob, clob.CONFIG.tokens.USDC, clob.CONFIG.clob);
        await clob.approveToken(bob, clob.CONFIG.tokens.WETH, clob.CONFIG.clob);
        
        // 4. Deposit to CLOB
        console.log('\n' + '='.repeat(60));
        console.log('4️⃣  DEPOSIT TO CLOB');
        console.log('='.repeat(60));
        
        // Note: USDC has 6 decimals in deployment
        await clob.deposit(alice, clob.CONFIG.tokens.USDC, parseUnits('500', 6));
        await clob.deposit(alice, clob.CONFIG.tokens.WETH, parseUnits('1', 18));
        
        await clob.deposit(bob, clob.CONFIG.tokens.USDC, parseUnits('500', 6));
        await clob.deposit(bob, clob.CONFIG.tokens.WETH, parseUnits('1', 18));
        
        // 5. Place orders
        console.log('\n' + '='.repeat(60));
        console.log('5️⃣  PLACE ORDERS');
        console.log('='.repeat(60));
        
        // Alice places a buy order for WETH/USDC
        const aliceOrder = await clob.placeOrder(
            alice,
            1, // WETH/USDC book
            true, // buy
            parseUnits('2000', 18), // price: 2000 USDC per WETH
            parseUnits('0.1', 18) // amount: 0.1 WETH
        );
        
        console.log('\n⏳ Waiting a bit before placing matching order...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Bob places a matching sell order
        const bobOrder = await clob.placeOrder(
            bob,
            1, // WETH/USDC book
            false, // sell
            parseUnits('2000', 18), // price: 2000 USDC per WETH
            parseUnits('0.1', 18) // amount: 0.1 WETH
        );
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETE!');
        console.log('='.repeat(60));
        
        console.log('\nOrders should have matched automatically!');
        console.log('Alice bought 0.1 WETH for 200 USDC');
        console.log('Bob sold 0.1 WETH for 200 USDC');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
main().catch(console.error);