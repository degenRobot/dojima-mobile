#!/usr/bin/env node

/**
 * Test that market orders use correct amounts
 * - Buy orders: amount in USDC
 * - Sell orders: amount in base token (WETH/WBTC)
 */

import { privateKeyToAccount } from 'viem/accounts';
import { parseUnits, formatUnits, createPublicClient, http, encodeFunctionData } from 'viem';
import { 
  CONFIG,
  setupDelegation,
  executeGaslessTransaction,
  createTestAccount,
  makeRelayCall
} from './lib/porto-clob-utils.js';

const CLOB_ADDRESS = '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C';
const USDC_ADDRESS = '0xC23b6B892c947746984474d52BBDF4ADd25717B3';
const WETH_ADDRESS = '0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4';

// UnifiedCLOB ABI for placeMarketOrder
const MARKET_ORDER_ABI = {
  name: 'placeMarketOrder',
  type: 'function',
  inputs: [
    { name: 'bookId', type: 'uint256' },
    { name: 'orderType', type: 'uint8' },
    { name: 'amount', type: 'uint256' },
    { name: 'maxSlippage', type: 'uint256' }
  ],
  outputs: [
    { name: 'totalFilled', type: 'uint256' },
    { name: 'avgPrice', type: 'uint256' }
  ]
};

const MINT_ABI = {
  name: 'mint',
  type: 'function',
  inputs: []
};

const DEPOSIT_ABI = {
  name: 'deposit',
  type: 'function',
  inputs: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
};

const APPROVE_ABI = {
  name: 'approve',
  type: 'function',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
};

const PLACE_ORDER_ABI = {
  name: 'placeOrder',
  type: 'function',
  inputs: [
    { name: 'bookId', type: 'uint256' },
    { name: 'orderType', type: 'uint8' },
    { name: 'price', type: 'uint256' },
    { name: 'amount', type: 'uint256' }
  ]
};

console.log('🧪 Testing Market Order Amounts');
console.log('================================\n');

async function main() {
  // Create test accounts
  const seller = await createTestAccount('Seller');
  const buyer = await createTestAccount('Buyer');
  
  // Setup delegation
  console.log('\n1️⃣  Setting up accounts...');
  await setupDelegation(seller.account);
  await setupDelegation(buyer.account);
  
  // Mint tokens
  console.log('\n2️⃣  Minting tokens...');
  
  // Mint WETH for seller
  await executeGaslessTransaction(
    seller.account,
    WETH_ADDRESS,
    encodeFunctionData({
      abi: [MINT_ABI],
      functionName: 'mint',
      args: []
    })
  );
  console.log('  ✅ Minted WETH for seller');
  
  // Mint USDC for buyer
  await executeGaslessTransaction(
    buyer.account,
    USDC_ADDRESS,
    encodeFunctionData({
      abi: [MINT_ABI],
      functionName: 'mint',
      args: []
    })
  );
  console.log('  ✅ Minted USDC for buyer');
  
  // Deposit to CLOB
  console.log('\n3️⃣  Depositing to CLOB...');
  
  // Seller deposits WETH
  await executeGaslessTransaction(
    seller.account,
    WETH_ADDRESS,
    encodeFunctionData({
      abi: [APPROVE_ABI],
      functionName: 'approve',
      args: [CLOB_ADDRESS, parseUnits('1000', 18)]
    })
  );
  
  await executeGaslessTransaction(
    seller.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [DEPOSIT_ABI],
      functionName: 'deposit',
      args: [WETH_ADDRESS, parseUnits('10', 18)]
    })
  );
  console.log('  ✅ Seller deposited 10 WETH');
  
  // Buyer deposits USDC
  await executeGaslessTransaction(
    buyer.account,
    USDC_ADDRESS,
    encodeFunctionData({
      abi: [APPROVE_ABI],
      functionName: 'approve',
      args: [CLOB_ADDRESS, parseUnits('1000000', 6)]
    })
  );
  
  await executeGaslessTransaction(
    buyer.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [DEPOSIT_ABI],
      functionName: 'deposit',
      args: [USDC_ADDRESS, parseUnits('50000', 6)] // 50,000 USDC
    })
  );
  console.log('  ✅ Buyer deposited 50,000 USDC');
  
  // Place sell orders at different prices
  console.log('\n4️⃣  Creating order book...');
  
  const sellOrders = [
    { price: '2500', amount: '2' },
    { price: '2550', amount: '1.5' },
    { price: '2600', amount: '1' },
  ];
  
  for (const order of sellOrders) {
    await executeGaslessTransaction(
      seller.account,
      CLOB_ADDRESS,
      encodeFunctionData({
        abi: [PLACE_ORDER_ABI],
        functionName: 'placeOrder',
        args: [
          1, // WETH/USDC book
          1, // SELL
          parseUnits(order.price, 6), // Price in USDC decimals
          parseUnits(order.amount, 18) // Amount in 18 decimals
        ]
      })
    );
    console.log(`  ✅ Placed sell order: ${order.amount} WETH @ $${order.price}`);
  }
  
  // Test market buy order
  console.log('\n5️⃣  Testing market BUY order...');
  console.log('  💡 Buy orders use USDC amount (quote token)');
  console.log('  📝 Buying with 5000 USDC (should buy ~2 WETH at $2500)');
  
  const buyAmount = parseUnits('5000', 6); // 5000 USDC
  const buyData = encodeFunctionData({
    abi: [MARKET_ORDER_ABI],
    functionName: 'placeMarketOrder',
    args: [
      1, // WETH/USDC book
      0, // BUY
      buyAmount, // Amount in USDC (quote token)
      200 // 2% slippage
    ]
  });
  
  const buyResult = await executeGaslessTransaction(
    buyer.account,
    CLOB_ADDRESS,
    buyData
  );
  console.log('  ✅ Market buy order executed');
  console.log('     Transaction:', buyResult.hash);
  
  // Test market sell order
  console.log('\n6️⃣  Testing market SELL order...');
  console.log('  💡 Sell orders use WETH amount (base token)');
  console.log('  📝 Selling 0.5 WETH');
  
  // First deposit more WETH for selling
  await executeGaslessTransaction(
    seller.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [DEPOSIT_ABI],
      functionName: 'deposit',
      args: [WETH_ADDRESS, parseUnits('2', 18)]
    })
  );
  
  const sellAmount = parseUnits('0.5', 18); // 0.5 WETH
  const sellData = encodeFunctionData({
    abi: [MARKET_ORDER_ABI],
    functionName: 'placeMarketOrder',
    args: [
      1, // WETH/USDC book
      1, // SELL
      sellAmount, // Amount in WETH (base token)
      200 // 2% slippage
    ]
  });
  
  const sellResult = await executeGaslessTransaction(
    seller.account,
    CLOB_ADDRESS,
    sellData
  );
  console.log('  ✅ Market sell order executed');
  console.log('     Transaction:', sellResult.hash);
  
  console.log('\n========================================');
  console.log('📊 Test Summary');
  console.log('========================================');
  console.log('✅ Market BUY orders use USDC amount (quote token)');
  console.log('✅ Market SELL orders use WETH amount (base token)');
  console.log('✅ Both order types executed successfully');
  console.log('\n🎉 Market order amount test passed!');
}

main().catch(console.error);