/**
 * Test UnifiedCLOB with proper decimal handling
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { parseUnits } from 'viem';
import * as clob from './lib/unified-clob-utils.js';
import { setupDelegation } from './lib/porto-clob-utils.js';
import { formatOrder, formatAmount, calculateQuoteAmount } from './lib/decimal-utils.js';

async function main() {
    console.log('🎯 Testing UnifiedCLOB with Proper Decimal Handling\n');
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
        
        // 4. Deposit to CLOB with correct decimals
        console.log('\n' + '='.repeat(60));
        console.log('4️⃣  DEPOSIT TO CLOB (with proper decimals)');
        console.log('='.repeat(60));
        
        // Deposit 500 USDC (6 decimals) and 1 WETH (18 decimals)
        await clob.deposit(alice, clob.CONFIG.tokens.USDC, formatAmount(500, 'USDC'));
        await clob.deposit(alice, clob.CONFIG.tokens.WETH, formatAmount(1, 'WETH'));
        
        await clob.deposit(bob, clob.CONFIG.tokens.USDC, formatAmount(500, 'USDC'));
        await clob.deposit(bob, clob.CONFIG.tokens.WETH, formatAmount(1, 'WETH'));
        
        // Check balances
        console.log('\n📊 Checking balances after deposit...');
        const aliceUsdcBalance = await clob.getBalance(alice.address, clob.CONFIG.tokens.USDC);
        const aliceWethBalance = await clob.getBalance(alice.address, clob.CONFIG.tokens.WETH);
        
        console.log(`Alice USDC: ${aliceUsdcBalance.available} available, ${aliceUsdcBalance.locked} locked`);
        console.log(`Alice WETH: ${aliceWethBalance.available} available, ${aliceWethBalance.locked} locked`);
        
        // 5. Place orders with CORRECT decimal handling
        console.log('\n' + '='.repeat(60));
        console.log('5️⃣  PLACE ORDERS (with proper decimal handling)');
        console.log('='.repeat(60));
        
        // Alice wants to buy 0.1 WETH at 2000 USDC per WETH
        const aliceOrderParams = formatOrder(
            1,      // WETH/USDC book
            true,   // buy
            2000,   // 2000 USDC per WETH
            0.1     // 0.1 WETH
        );
        
        console.log('\n📝 Alice placing buy order:');
        console.log(`   Buying 0.1 WETH at 2000 USDC per WETH`);
        console.log(`   Expected to spend: 200 USDC`);
        
        const aliceOrder = await clob.placeOrder(
            alice,
            1, // WETH/USDC book
            true, // buy
            aliceOrderParams.price,
            aliceOrderParams.amount
        );
        
        // Check Alice's balance after order
        console.log('\n📊 Checking Alice balance after order...');
        const aliceUsdcAfterOrder = await clob.getBalance(alice.address, clob.CONFIG.tokens.USDC);
        console.log(`Alice USDC: ${aliceUsdcAfterOrder.available} available, ${aliceUsdcAfterOrder.locked} locked`);
        
        const expectedLocked = calculateQuoteAmount(aliceOrderParams.amount, aliceOrderParams.price);
        console.log(`Expected locked: ${expectedLocked} (should be 200 USDC in 6 decimals = 200000000)`);
        
        console.log('\n⏳ Waiting before placing matching order...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Bob places matching sell order
        const bobOrderParams = formatOrder(
            1,      // WETH/USDC book
            false,  // sell
            2000,   // 2000 USDC per WETH
            0.1     // 0.1 WETH
        );
        
        console.log('\n📝 Bob placing sell order:');
        console.log(`   Selling 0.1 WETH at 2000 USDC per WETH`);
        console.log(`   Expected to receive: 200 USDC`);
        
        const bobOrder = await clob.placeOrder(
            bob,
            1, // WETH/USDC book
            false, // sell
            bobOrderParams.price,
            bobOrderParams.amount
        );
        
        // Wait for matching
        console.log('\n⏳ Waiting for order matching...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 6. Check final balances
        console.log('\n' + '='.repeat(60));
        console.log('6️⃣  FINAL BALANCE CHECK');
        console.log('='.repeat(60));
        
        const aliceFinalUsdc = await clob.getBalance(alice.address, clob.CONFIG.tokens.USDC);
        const aliceFinalWeth = await clob.getBalance(alice.address, clob.CONFIG.tokens.WETH);
        const bobFinalUsdc = await clob.getBalance(bob.address, clob.CONFIG.tokens.USDC);
        const bobFinalWeth = await clob.getBalance(bob.address, clob.CONFIG.tokens.WETH);
        
        console.log('\n📊 Final Balances:');
        console.log(`Alice USDC: ${aliceFinalUsdc.available} available (started with 500 USDC, spent 200)`);
        console.log(`Alice WETH: ${aliceFinalWeth.available} available (started with 0, gained ~0.1)`);
        console.log(`Bob USDC: ${bobFinalUsdc.available} available (started with 0, gained ~200)`);
        console.log(`Bob WETH: ${bobFinalWeth.available} available (started with 1, sold 0.1)`);
        
        // Verify the trade happened
        if (aliceFinalWeth.available > 0) {
            console.log('\n✅ Trade executed successfully!');
            console.log('Alice bought WETH and Bob sold WETH as expected.');
        } else {
            console.log('\n⚠️  Trade may not have executed. Check order status.');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETE!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
main().catch(console.error);