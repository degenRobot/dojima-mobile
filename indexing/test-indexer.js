#!/usr/bin/env node

// Simple test script for CLOB indexer
// Usage: node test-indexer.js

const INDEXER_URL = 'http://localhost:42069';

async function testQuery(name, query, variables = {}) {
  console.log(`\n=== Testing: ${name} ===`);
  
  try {
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      return false;
    }
    
    console.log('✅ Success');
    console.log('Result:', JSON.stringify(data.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('CLOB Indexer Integration Tests');
  console.log('==============================');
  console.log(`Testing endpoint: ${INDEXER_URL}`);
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Basic connectivity
  if (await testQuery('Basic Connectivity', '{ _meta { status } }')) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 2: Order History
  if (await testQuery('Order History', `
    {
      orderHistorys(limit: 3) {
        items {
          id
          trader {
            address
          }
          status
          price
          originalAmount
        }
      }
    }
  `)) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 3: Active Orders
  if (await testQuery('Active Orders', `
    {
      activeOrders(limit: 3) {
        items {
          id
          orderId
          trader {
            address
          }
          isBuy
          price
          remainingAmount
        }
      }
    }
  `)) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 4: Recent Trades
  if (await testQuery('Recent Trades', `
    {
      trades(orderBy: "timestamp", orderDirection: "desc", limit: 3) {
        items {
          id
          price
          amount
          timestamp
          buyer {
            address
          }
          seller {
            address
          }
        }
      }
    }
  `)) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 5: User Trades
  if (await testQuery('User Trades', `
    {
      userTrades(limit: 3) {
        items {
          id
          trader {
            address
          }
          side
          role
          price
          amount
          fee
        }
      }
    }
  `)) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 6: Order Book Query
  const marketAddress = '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222';
  if (await testQuery('Order Book', `
    query GetOrderBook($market: String!) {
      buyOrders: activeOrders(
        where: { market: $market, isBuy: true }
        orderBy: "price"
        orderDirection: "desc"
        limit: 5
      ) {
        items {
          price
          remainingAmount
        }
      }
      sellOrders: activeOrders(
        where: { market: $market, isBuy: false }
        orderBy: "price"
        orderDirection: "asc"
        limit: 5
      ) {
        items {
          price
          remainingAmount
        }
      }
    }
  `, { market: marketAddress.toLowerCase() })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 7: Market Stats
  if (await testQuery('Market Stats', `
    query GetMarketStats($market: String!) {
      market24hStats(market: $market) {
        volume24h
        trades24h
        high24h
        low24h
      }
      marketPrice(market: $market) {
        lastPrice
        priceChange24h
      }
    }
  `, { market: marketAddress.toLowerCase() })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 8: User Balances
  if (await testQuery('User Balances', `
    {
      balances(limit: 3) {
        items {
          id
          user {
            address
          }
          available
          locked
          total
        }
      }
    }
  `)) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 9: Pagination
  if (await testQuery('Pagination', `
    {
      orderHistorys(limit: 2) {
        items {
          id
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `)) {
    passed++;
  } else {
    failed++;
  }
  
  // Summary
  console.log('\n==============================');
  console.log(`Tests Passed: ${passed}`);
  console.log(`Tests Failed: ${failed}`);
  console.log(`Total Tests: ${passed + failed}`);
  console.log('==============================');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Check if indexer is running
async function checkIndexer() {
  try {
    const response = await fetch(INDEXER_URL);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Main
(async () => {
  console.log('Checking if indexer is running...');
  if (!(await checkIndexer())) {
    console.error('❌ Indexer is not running at', INDEXER_URL);
    console.error('Please start the indexer with: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Indexer is running');
  await runTests();
})();