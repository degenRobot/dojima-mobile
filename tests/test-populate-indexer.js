#!/usr/bin/env node

/**
 * Populate indexer with test data
 */

import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { 
  setupDelegation,
  executeGaslessTransaction,
  createTestAccount
} from './lib/porto-clob-utils.js';

const CLOB_ADDRESS = '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C';
const USDC_ADDRESS = '0xC23b6B892c947746984474d52BBDF4ADd25717B3';
const WETH_ADDRESS = '0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4';
const INDEXER_URL = process.env.INDEXER_URL || 'http://localhost:42070';

// ABIs
const MINT_ABI = {
  name: 'mint',
  type: 'function',
  inputs: []
};

const APPROVE_ABI = {
  name: 'approve',
  type: 'function',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
};

const DEPOSIT_ABI = {
  name: 'deposit',
  type: 'function',
  inputs: [
    { name: 'token', type: 'address' },
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

const MARKET_ORDER_ABI = {
  name: 'placeMarketOrder',
  type: 'function',
  inputs: [
    { name: 'bookId', type: 'uint256' },
    { name: 'orderType', type: 'uint8' },
    { name: 'amount', type: 'uint256' },
    { name: 'maxSlippage', type: 'uint256' }
  ]
};

console.log('🚀 Populating Indexer with Test Data');
console.log('=====================================\n');

async function setupTrader(name) {
  const trader = await createTestAccount(name);
  console.log(`\n👤 Setting up ${name}: ${trader.account.address}`);
  
  await setupDelegation(trader.account);
  
  // Mint tokens
  await executeGaslessTransaction(
    trader.account,
    USDC_ADDRESS,
    encodeFunctionData({
      abi: [MINT_ABI],
      functionName: 'mint'
    })
  );
  
  await executeGaslessTransaction(
    trader.account,
    WETH_ADDRESS,
    encodeFunctionData({
      abi: [MINT_ABI],
      functionName: 'mint'
    })
  );
  
  console.log(`  ✅ Minted USDC and WETH`);
  
  // Approve and deposit USDC
  await executeGaslessTransaction(
    trader.account,
    USDC_ADDRESS,
    encodeFunctionData({
      abi: [APPROVE_ABI],
      functionName: 'approve',
      args: [CLOB_ADDRESS, parseUnits('100000', 6)]
    })
  );
  
  await executeGaslessTransaction(
    trader.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [DEPOSIT_ABI],
      functionName: 'deposit',
      args: [USDC_ADDRESS, parseUnits('10000', 6)]
    })
  );
  
  console.log(`  ✅ Deposited 10,000 USDC`);
  
  // Approve and deposit WETH
  await executeGaslessTransaction(
    trader.account,
    WETH_ADDRESS,
    encodeFunctionData({
      abi: [APPROVE_ABI],
      functionName: 'approve',
      args: [CLOB_ADDRESS, parseUnits('100', 18)]
    })
  );
  
  await executeGaslessTransaction(
    trader.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [DEPOSIT_ABI],
      functionName: 'deposit',
      args: [WETH_ADDRESS, parseUnits('5', 18)]
    })
  );
  
  console.log(`  ✅ Deposited 5 WETH`);
  
  return trader;
}

async function checkIndexerData() {
  console.log('\n📊 Checking Indexer Data...');
  
  try {
    // Query active orders
    const ordersQuery = {
      query: `
        query {
          active_orders(first: 100) {
            items {
              id
              bookId
              orderType
              price
              amount
              status
            }
          }
        }
      `
    };
    
    const ordersResponse = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ordersQuery)
    });
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.active_orders?.items || [];
    console.log(`  Active orders: ${orders.length}`);
    
    // Query trades
    const tradesQuery = {
      query: `
        query {
          trades(first: 100) {
            items {
              id
              bookId
              price
              amount
            }
          }
        }
      `
    };
    
    const tradesResponse = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradesQuery)
    });
    
    const tradesData = await tradesResponse.json();
    const trades = tradesData.data?.trades?.items || [];
    console.log(`  Trades: ${trades.length}`);
    
    // Query balances
    const balancesQuery = {
      query: `
        query {
          balances(first: 100) {
            items {
              id
              user
              available
              locked
            }
          }
        }
      `
    };
    
    const balancesResponse = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(balancesQuery)
    });
    
    const balancesData = await balancesResponse.json();
    const balances = balancesData.data?.balances?.items || [];
    console.log(`  Balance entries: ${balances.length}`);
    
  } catch (error) {
    console.error('❌ Error querying indexer:', error.message);
  }
}

async function main() {
  // Setup traders
  const alice = await setupTrader('Alice');
  const bob = await setupTrader('Bob');
  
  console.log('\n📈 Placing Limit Orders...');
  
  // Alice places sell orders
  await executeGaslessTransaction(
    alice.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [PLACE_ORDER_ABI],
      functionName: 'placeOrder',
      args: [
        1n, // Book 1: WETH/USDC
        1,  // SELL
        parseUnits('2500', 6), // $2500
        parseUnits('1', 18)     // 1 WETH
      ]
    })
  );
  console.log('  ✅ Alice: SELL 1 WETH @ $2500');
  
  await executeGaslessTransaction(
    alice.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [PLACE_ORDER_ABI],
      functionName: 'placeOrder',
      args: [
        1n,
        1,  // SELL
        parseUnits('2550', 6),
        parseUnits('0.5', 18)
      ]
    })
  );
  console.log('  ✅ Alice: SELL 0.5 WETH @ $2550');
  
  // Bob places buy orders
  await executeGaslessTransaction(
    bob.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [PLACE_ORDER_ABI],
      functionName: 'placeOrder',
      args: [
        1n,
        0,  // BUY
        parseUnits('2450', 6),
        parseUnits('0.8', 18)
      ]
    })
  );
  console.log('  ✅ Bob: BUY 0.8 WETH @ $2450');
  
  await executeGaslessTransaction(
    bob.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [PLACE_ORDER_ABI],
      functionName: 'placeOrder',
      args: [
        1n,
        0,  // BUY
        parseUnits('2400', 6),
        parseUnits('1.2', 18)
      ]
    })
  );
  console.log('  ✅ Bob: BUY 1.2 WETH @ $2400');
  
  console.log('\n💱 Executing Market Orders...');
  
  // Bob executes market buy to trigger trades
  await executeGaslessTransaction(
    bob.account,
    CLOB_ADDRESS,
    encodeFunctionData({
      abi: [MARKET_ORDER_ABI],
      functionName: 'placeMarketOrder',
      args: [
        1n,
        0,  // BUY
        parseUnits('1250', 6), // Buy with 1250 USDC (should buy 0.5 WETH at $2500)
        200 // 2% slippage
      ]
    })
  );
  console.log('  ✅ Bob: Market BUY with 1250 USDC');
  
  // Wait a bit for indexer to process
  console.log('\n⏳ Waiting for indexer to process events...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check final state
  await checkIndexerData();
  
  console.log('\n=====================================');
  console.log('✅ Indexer populated with test data!');
}

main().catch(console.error);