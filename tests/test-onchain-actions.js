/**
 * Test all on-chain actions (deposit, withdraw, placeOrder, placeMarketOrder)
 * Tests the unified flow through the mobile app's hook functions
 */

import { createTestAccount, waitForTransaction, executeGaslessTransaction, approveToken } from './lib/porto-clob-utils.js';
import { parseEther, formatEther, encodeFunctionData, decodeFunctionResult, parseUnits, formatUnits } from 'viem';

const CONTRACTS = {
  UnifiedCLOB: '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C',
  USDC: '0xC23b6B892c947746984474d52BBDF4ADd25717B3',
  WETH: '0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4',
  WBTC: '0x7C4B1b2953Fd3bB0A4aC07da70b0839d1D09c2cA',
};

const TRADING_BOOKS = [
  { id: 1, base: 'WETH', quote: 'USDC', baseDecimals: 18, quoteDecimals: 6 },
  { id: 2, base: 'WBTC', quote: 'USDC', baseDecimals: 8, quoteDecimals: 6 },
];

// ABIs
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

const CLOB_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    name: 'placeOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bookId', type: 'uint256' },
      { name: 'orderType', type: 'uint8' }, // 0 = buy, 1 = sell
      { name: 'price', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'placeMarketOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bookId', type: 'uint256' },
      { name: 'orderType', type: 'uint8' }, // 0 = buy, 1 = sell
      { name: 'amount', type: 'uint256' },
      { name: 'maxSlippage', type: 'uint256' }, // in basis points (100 = 1%)
    ],
    outputs: [
      { name: 'totalFilled', type: 'uint256' },
      { name: 'avgPrice', type: 'uint256' },
    ],
  },
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [
      { name: 'available', type: 'uint256' },
      { name: 'locked', type: 'uint256' },
    ],
  },
];

async function testDepositAction(account, tokenAddress, amount) {
  console.log('\n🏦 Testing Deposit Action...');
  
  // First approve the token
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CONTRACTS.UnifiedCLOB, amount],
  });
  
  console.log('   Approving token spend...');
  const approveResult = await executeGaslessTransaction(account, tokenAddress, approveData);
  await waitForTransaction(approveResult.bundleId);
  
  // Then deposit
  const depositData = encodeFunctionData({
    abi: CLOB_ABI,
    functionName: 'deposit',
    args: [tokenAddress, amount],
  });
  
  console.log(`   Depositing ${formatUnits(amount, 6)} tokens...`);
  const depositResult = await executeGaslessTransaction(account, CONTRACTS.UnifiedCLOB, depositData);
  await waitForTransaction(depositResult.bundleId);
  
  console.log('   ✅ Deposit successful!');
  return depositResult.bundleId;
}

async function testWithdrawAction(account, tokenAddress, amount) {
  console.log('\n💸 Testing Withdraw Action...');
  
  const withdrawData = encodeFunctionData({
    abi: CLOB_ABI,
    functionName: 'withdraw',
    args: [tokenAddress, amount],
  });
  
  console.log(`   Withdrawing ${formatUnits(amount, 6)} tokens...`);
  const withdrawResult = await executeGaslessTransaction(account, CONTRACTS.UnifiedCLOB, withdrawData);
  await waitForTransaction(withdrawResult.bundleId);
  
  console.log('   ✅ Withdraw successful!');
  return withdrawResult.bundleId;
}

async function testPlaceLimitOrder(account, bookId, isBuy, price, amount) {
  console.log('\n📈 Testing Place Limit Order Action...');
  
  const book = TRADING_BOOKS.find(b => b.id === bookId);
  const priceBigInt = parseUnits(price.toString(), book.quoteDecimals);
  const amountBigInt = parseUnits(amount.toString(), 18); // Always 18 decimals for amount
  
  const orderData = encodeFunctionData({
    abi: CLOB_ABI,
    functionName: 'placeOrder',
    args: [
      bookId,
      isBuy ? 0 : 1,
      priceBigInt,
      amountBigInt,
    ],
  });
  
  console.log(`   Placing ${isBuy ? 'BUY' : 'SELL'} order: ${amount} ${book.base} @ $${price}...`);
  const orderResult = await executeGaslessTransaction(account, CONTRACTS.UnifiedCLOB, orderData);
  await waitForTransaction(orderResult.bundleId);
  
  console.log('   ✅ Limit order placed successfully!');
  return orderResult.bundleId;
}

async function testPlaceMarketOrder(account, bookId, isBuy, amount, slippageBps = 100) {
  console.log('\n⚡ Testing Place Market Order Action...');
  
  const book = TRADING_BOOKS.find(b => b.id === bookId);
  const amountBigInt = parseUnits(amount.toString(), 18); // Always 18 decimals for amount
  
  const orderData = encodeFunctionData({
    abi: CLOB_ABI,
    functionName: 'placeMarketOrder',
    args: [
      bookId,
      isBuy ? 0 : 1,
      amountBigInt,
      slippageBps,
    ],
  });
  
  console.log(`   Placing MARKET ${isBuy ? 'BUY' : 'SELL'}: ${amount} ${book.base} with ${slippageBps/100}% slippage...`);
  const orderResult = await executeGaslessTransaction(account, CONTRACTS.UnifiedCLOB, orderData);
  await waitForTransaction(orderResult.bundleId);
  
  console.log('   ✅ Market order executed successfully!');
  return orderResult.bundleId;
}

async function checkCLOBBalance(userAddress, tokenAddress) {
  const data = encodeFunctionData({
    abi: CLOB_ABI,
    functionName: 'getBalance',
    args: [userAddress, tokenAddress],
  });
  
  const response = await fetch('https://testnet.riselabs.xyz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{
        to: CONTRACTS.UnifiedCLOB,
        data
      }, 'latest'],
      id: 1,
    }),
  });
  
  const result = await response.json();
  const [available, locked] = decodeFunctionResult({
    abi: CLOB_ABI,
    functionName: 'getBalance',
    data: result.result,
  });
  
  return { available, locked };
}

async function main() {
  console.log('===========================================');
  console.log('   Testing On-Chain Actions');
  console.log('===========================================');
  
  try {
    // Create test account
    const { privateKey, account } = await createTestAccount('OnChainActionsTest');
    const userAddress = account.address;
    console.log('\n📱 User Address:', userAddress);
    
    // Check initial CLOB balance
    console.log('\n📊 Checking initial CLOB balances...');
    const initialUSDCBalance = await checkCLOBBalance(userAddress, CONTRACTS.USDC);
    const initialWETHBalance = await checkCLOBBalance(userAddress, CONTRACTS.WETH);
    
    console.log('   USDC - Available:', formatUnits(initialUSDCBalance.available, 6), 'Locked:', formatUnits(initialUSDCBalance.locked, 6));
    console.log('   WETH - Available:', formatUnits(initialWETHBalance.available, 18), 'Locked:', formatUnits(initialWETHBalance.locked, 18));
    
    // Test 1: Deposit USDC
    const depositAmount = parseUnits('1000', 6); // 1000 USDC
    await testDepositAction(account, CONTRACTS.USDC, depositAmount);
    
    // Check balance after deposit
    const afterDepositBalance = await checkCLOBBalance(userAddress, CONTRACTS.USDC);
    console.log('   USDC after deposit - Available:', formatUnits(afterDepositBalance.available, 6));
    
    // Test 2: Place limit orders to create market depth
    console.log('\n📚 Creating market depth with limit orders...');
    
    // Place some sell orders (we need WETH for this)
    console.log('   First depositing WETH for sell orders...');
    await testDepositAction(account, CONTRACTS.WETH, parseUnits('0.5', 18)); // Deposit 0.5 WETH
    
    // Place sell orders at different prices
    await testPlaceLimitOrder(account, 1, false, 2520, 0.1); // Sell 0.1 WETH at $2520
    await testPlaceLimitOrder(account, 1, false, 2530, 0.1); // Sell 0.1 WETH at $2530
    await testPlaceLimitOrder(account, 1, false, 2540, 0.1); // Sell 0.1 WETH at $2540
    
    // Place buy orders at different prices  
    await testPlaceLimitOrder(account, 1, true, 2480, 0.1); // Buy 0.1 WETH at $2480
    await testPlaceLimitOrder(account, 1, true, 2470, 0.1); // Buy 0.1 WETH at $2470
    await testPlaceLimitOrder(account, 1, true, 2460, 0.1); // Buy 0.1 WETH at $2460
    
    // Test 3: Place a market buy order
    console.log('\n🎯 Testing market orders...');
    await testPlaceMarketOrder(account, 1, true, 0.05, 200); // Market buy 0.05 WETH with 2% slippage
    
    // Test 4: Place a market sell order
    await testPlaceMarketOrder(account, 1, false, 0.02, 150); // Market sell 0.02 WETH with 1.5% slippage
    
    // Test 5: Withdraw some USDC
    const withdrawAmount = parseUnits('100', 6); // 100 USDC
    await testWithdrawAction(account, CONTRACTS.USDC, withdrawAmount);
    
    // Final balance check
    console.log('\n📊 Final CLOB balances:');
    const finalUSDCBalance = await checkCLOBBalance(userAddress, CONTRACTS.USDC);
    const finalWETHBalance = await checkCLOBBalance(userAddress, CONTRACTS.WETH);
    
    console.log('   USDC - Available:', formatUnits(finalUSDCBalance.available, 6), 'Locked:', formatUnits(finalUSDCBalance.locked, 6));
    console.log('   WETH - Available:', formatUnits(finalWETHBalance.available, 18), 'Locked:', formatUnits(finalWETHBalance.locked, 18));
    
    console.log('\n===========================================');
    console.log('   ✅ All on-chain actions tested successfully!');
    console.log('===========================================');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);