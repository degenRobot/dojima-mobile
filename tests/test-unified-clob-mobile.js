/**
 * Test UnifiedCLOB integration with mobile app utilities
 * This tests the actual flow using the mobile app's decimal handling
 */

import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { parseUnits } from 'viem';
import * as clob from './lib/unified-clob-utils.js';
import { setupDelegation } from './lib/porto-clob-utils.js';

// Import mobile utilities (we'll copy the logic here for testing)
const formatAmountForContract = (humanAmount, token) => {
  // Always scale to 18 decimals for the contract
  return BigInt(Math.floor(humanAmount * 10 ** 18));
};

const formatPriceForContract = (humanPrice, quoteToken) => {
  const decimals = { USDC: 6, WETH: 18, WBTC: 8 }[quoteToken];
  return BigInt(Math.floor(humanPrice * 10 ** decimals));
};

async function main() {
  console.log('🎯 Testing UnifiedCLOB with Mobile Decimal Handling\n');
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
    await clob.mintTokens(alice, clob.CONFIG.tokens.WBTC);
    
    await clob.mintTokens(bob, clob.CONFIG.tokens.USDC);
    await clob.mintTokens(bob, clob.CONFIG.tokens.WETH);
    await clob.mintTokens(bob, clob.CONFIG.tokens.WBTC);
    
    // 3. Approve CLOB
    console.log('\n' + '='.repeat(60));
    console.log('3️⃣  APPROVE CLOB');
    console.log('='.repeat(60));
    
    await clob.approveToken(alice, clob.CONFIG.tokens.USDC, clob.CONFIG.clob);
    await clob.approveToken(alice, clob.CONFIG.tokens.WETH, clob.CONFIG.clob);
    await clob.approveToken(alice, clob.CONFIG.tokens.WBTC, clob.CONFIG.clob);
    
    await clob.approveToken(bob, clob.CONFIG.tokens.USDC, clob.CONFIG.clob);
    await clob.approveToken(bob, clob.CONFIG.tokens.WETH, clob.CONFIG.clob);
    await clob.approveToken(bob, clob.CONFIG.tokens.WBTC, clob.CONFIG.clob);
    
    // 4. Deposit to CLOB
    console.log('\n' + '='.repeat(60));
    console.log('4️⃣  DEPOSIT TO CLOB');
    console.log('='.repeat(60));
    
    // Deposit with proper decimals
    await clob.deposit(alice, clob.CONFIG.tokens.USDC, parseUnits('1000', 6));
    await clob.deposit(alice, clob.CONFIG.tokens.WETH, parseUnits('10', 18));
    await clob.deposit(alice, clob.CONFIG.tokens.WBTC, parseUnits('1', 8));
    
    await clob.deposit(bob, clob.CONFIG.tokens.USDC, parseUnits('1000', 6));
    await clob.deposit(bob, clob.CONFIG.tokens.WETH, parseUnits('10', 18));
    await clob.deposit(bob, clob.CONFIG.tokens.WBTC, parseUnits('1', 8));
    
    // 5. Test different trading pairs with proper decimal handling
    console.log('\n' + '='.repeat(60));
    console.log('5️⃣  TEST TRADING PAIRS');
    console.log('='.repeat(60));
    
    // Test 1: WETH/USDC (18/6 decimals)
    console.log('\n📊 Testing WETH/USDC pair...');
    console.log('Alice buys 0.1 WETH at 2000 USDC');
    
    const wethAmount = formatAmountForContract(0.1, 'WETH');
    const usdcPrice = formatPriceForContract(2000, 'USDC');
    
    await clob.placeOrder(
      alice,
      1, // WETH/USDC book
      true, // buy
      usdcPrice,
      wethAmount
    );
    
    console.log('Bob sells 0.1 WETH at 2000 USDC');
    await clob.placeOrder(
      bob,
      1, // WETH/USDC book
      false, // sell
      usdcPrice,
      wethAmount
    );
    
    console.log('✅ WETH/USDC orders should match');
    
    // Test 2: WBTC/USDC (8/6 decimals) 
    console.log('\n📊 Testing WBTC/USDC pair...');
    console.log('Alice buys 0.01 WBTC at 50000 USDC');
    
    const wbtcAmount = formatAmountForContract(0.01, 'WBTC');
    const wbtcPrice = formatPriceForContract(50000, 'USDC');
    
    await clob.placeOrder(
      alice,
      2, // WBTC/USDC book
      true, // buy
      wbtcPrice,
      wbtcAmount
    );
    
    console.log('Bob sells 0.01 WBTC at 50000 USDC');
    await clob.placeOrder(
      bob,
      2, // WBTC/USDC book
      false, // sell
      wbtcPrice,
      wbtcAmount
    );
    
    console.log('✅ WBTC/USDC orders should match');
    
    // Test 3: WETH/WBTC (18/8 decimals)
    console.log('\n📊 Testing WETH/WBTC pair...');
    console.log('Alice buys 1 WETH at 0.04 WBTC');
    
    const wethAmount2 = formatAmountForContract(1, 'WETH');
    const wbtcPrice2 = formatPriceForContract(0.04, 'WBTC');
    
    await clob.placeOrder(
      alice,
      3, // WETH/WBTC book
      true, // buy
      wbtcPrice2,
      wethAmount2
    );
    
    console.log('Bob sells 1 WETH at 0.04 WBTC');
    await clob.placeOrder(
      bob,
      3, // WETH/WBTC book
      false, // sell
      wbtcPrice2,
      wethAmount2
    );
    
    console.log('✅ WETH/WBTC orders should match');
    
    // 6. Check final balances
    console.log('\n' + '='.repeat(60));
    console.log('6️⃣  CHECK FINAL BALANCES');
    console.log('='.repeat(60));
    
    console.log('\n📊 Checking balances after trades...');
    
    // Get Alice's balances
    const aliceUsdcBalance = await clob.getBalance(alice.address, clob.CONFIG.tokens.USDC);
    const aliceWethBalance = await clob.getBalance(alice.address, clob.CONFIG.tokens.WETH);
    const aliceWbtcBalance = await clob.getBalance(alice.address, clob.CONFIG.tokens.WBTC);
    
    console.log('\nAlice balances:');
    console.log(`  USDC: ${aliceUsdcBalance.available} available, ${aliceUsdcBalance.locked} locked`);
    console.log(`  WETH: ${aliceWethBalance.available} available, ${aliceWethBalance.locked} locked`);
    console.log(`  WBTC: ${aliceWbtcBalance.available} available, ${aliceWbtcBalance.locked} locked`);
    
    // Get Bob's balances
    const bobUsdcBalance = await clob.getBalance(bob.address, clob.CONFIG.tokens.USDC);
    const bobWethBalance = await clob.getBalance(bob.address, clob.CONFIG.tokens.WETH);
    const bobWbtcBalance = await clob.getBalance(bob.address, clob.CONFIG.tokens.WBTC);
    
    console.log('\nBob balances:');
    console.log(`  USDC: ${bobUsdcBalance.available} available, ${bobUsdcBalance.locked} locked`);
    console.log(`  WETH: ${bobWethBalance.available} available, ${bobWethBalance.locked} locked`);
    console.log(`  WBTC: ${bobWbtcBalance.available} available, ${bobWbtcBalance.locked} locked`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📝 Summary:');
    console.log('- Tested WETH/USDC with 18/6 decimal combination');
    console.log('- Tested WBTC/USDC with 8/6 decimal combination');
    console.log('- Tested WETH/WBTC with 18/8 decimal combination');
    console.log('- All orders placed with proper decimal normalization');
    console.log('- Contract expects base amounts in 18 decimals');
    console.log('- Prices use quote token native decimals');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);