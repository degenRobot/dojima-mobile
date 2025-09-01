#!/usr/bin/env node

/**
 * Quick check of indexer and order book state
 */

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';

const RPC_URL = 'https://testnet.riselabs.xyz';
const INDEXER_URL = process.env.INDEXER_URL || 'http://localhost:42070';
const CLOB_ADDRESS = '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C';

// Minimal ABIs
const GET_ORDERS_ABI = {
  name: 'getOrders',
  type: 'function',
  inputs: [
    { name: 'bookId', type: 'uint256' },
    { name: 'orderType', type: 'uint8' },
    { name: 'limit', type: 'uint256' }
  ],
  outputs: [
    {
      name: 'orders',
      type: 'tuple[]',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'trader', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'orderType', type: 'uint8' },
        { name: 'timestamp', type: 'uint256' }
      ]
    }
  ]
};

const GET_MARKET_INFO_ABI = {
  name: 'getMarketInfo',
  type: 'function',
  inputs: [{ name: 'bookId', type: 'uint256' }],
  outputs: [
    { name: 'lastPrice', type: 'uint256' },
    { name: 'volume24h', type: 'uint256' },
    { name: 'high24h', type: 'uint256' },
    { name: 'low24h', type: 'uint256' },
    { name: 'spread', type: 'uint256' },
    { name: 'midPrice', type: 'uint256' }
  ]
};

console.log('🔍 Checking Indexer and Order Book State');
console.log('=========================================\n');

// Create public client
const client = createPublicClient({
  transport: http(RPC_URL),
  chain: {
    id: 11155931,
    name: 'RISE',
    network: 'rise-testnet',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [RPC_URL] },
      public: { http: [RPC_URL] }
    }
  }
});

async function checkOrderBook() {
  console.log('📊 Checking On-Chain Order Book (Book 1: WETH/USDC)');
  console.log('---------------------------------------------------');
  
  try {
    // Get buy orders
    const buyOrders = await client.readContract({
      address: CLOB_ADDRESS,
      abi: [GET_ORDERS_ABI],
      functionName: 'getOrders',
      args: [1n, 0, 10n] // Book 1, BUY orders, limit 10
    });
    
    console.log(`\n📈 Buy Orders (${buyOrders.length}):`);
    if (buyOrders.length > 0) {
      buyOrders.forEach(order => {
        const price = formatUnits(order.price, 6);
        const amount = formatUnits(order.amount, 18);
        console.log(`  ID ${order.id}: ${amount} WETH @ $${price}`);
      });
    } else {
      console.log('  No buy orders');
    }
    
    // Get sell orders
    const sellOrders = await client.readContract({
      address: CLOB_ADDRESS,
      abi: [GET_ORDERS_ABI],
      functionName: 'getOrders',
      args: [1n, 1, 10n] // Book 1, SELL orders, limit 10
    });
    
    console.log(`\n📉 Sell Orders (${sellOrders.length}):`);
    if (sellOrders.length > 0) {
      sellOrders.forEach(order => {
        const price = formatUnits(order.price, 6);
        const amount = formatUnits(order.amount, 18);
        console.log(`  ID ${order.id}: ${amount} WETH @ $${price}`);
      });
    } else {
      console.log('  No sell orders');
    }
    
    // Get market info
    const marketInfo = await client.readContract({
      address: CLOB_ADDRESS,
      abi: [GET_MARKET_INFO_ABI],
      functionName: 'getMarketInfo',
      args: [1n]
    });
    
    console.log('\n📈 Market Info:');
    console.log(`  Last Price: $${formatUnits(marketInfo[0], 6)}`);
    console.log(`  24h Volume: ${formatUnits(marketInfo[1], 18)} WETH`);
    console.log(`  Spread: $${formatUnits(marketInfo[4], 6)}`);
    console.log(`  Mid Price: $${formatUnits(marketInfo[5], 6)}`);
    
  } catch (error) {
    console.error('❌ Error reading order book:', error.message);
  }
}

async function checkIndexer() {
  console.log('\n\n📡 Checking Indexer GraphQL API');
  console.log('--------------------------------');
  console.log('URL:', INDEXER_URL);
  
  try {
    // Test basic connectivity
    const healthResponse = await fetch(`${INDEXER_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ Indexer is healthy\n');
    } else {
      console.log('⚠️ Indexer health check failed\n');
    }
    
    // Query orders
    const ordersQuery = {
      query: `
        query {
          active_orders(first: 10, orderBy: "price", orderDirection: "desc") {
            items {
              id
              trader
              bookId
              orderType
              price
              amount
              status
              timestamp
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
    
    if (ordersData.data?.active_orders?.items) {
      const orders = ordersData.data.active_orders.items;
      console.log(`📚 Active Orders in Indexer (${orders.length}):`);
      orders.forEach(order => {
        const type = order.orderType === 'BUY' ? '📈' : '📉';
        console.log(`  ${type} Book ${order.bookId}: ${order.amount} @ ${order.price} (${order.status})`);
      });
    } else {
      console.log('📚 No active orders in indexer');
    }
    
    // Query recent trades
    const tradesQuery = {
      query: `
        query {
          trades(first: 5, orderBy: "timestamp", orderDirection: "desc") {
            items {
              id
              bookId
              price
              amount
              timestamp
              buyOrderId
              sellOrderId
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
    
    if (tradesData.data?.trades?.items) {
      const trades = tradesData.data.trades.items;
      console.log(`\n💱 Recent Trades (${trades.length}):`);
      trades.forEach(trade => {
        const date = new Date(parseInt(trade.timestamp) * 1000).toLocaleTimeString();
        console.log(`  Book ${trade.bookId}: ${trade.amount} @ ${trade.price} at ${date}`);
      });
    } else {
      console.log('\n💱 No recent trades in indexer');
    }
    
    // Query user balances
    const balancesQuery = {
      query: `
        query {
          balances(first: 10) {
            items {
              id
              user
              token
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
    
    if (balancesData.data?.balances?.items) {
      const balances = balancesData.data.balances.items;
      console.log(`\n💰 User Balances (${balances.length} entries):`);
      const uniqueUsers = [...new Set(balances.map(b => b.user))];
      console.log(`  Unique users: ${uniqueUsers.length}`);
    } else {
      console.log('\n💰 No user balances in indexer');
    }
    
  } catch (error) {
    console.error('❌ Error checking indexer:', error.message);
  }
}

async function main() {
  await checkOrderBook();
  await checkIndexer();
  
  console.log('\n\n=========================================');
  console.log('✅ Check complete!');
}

main().catch(console.error);