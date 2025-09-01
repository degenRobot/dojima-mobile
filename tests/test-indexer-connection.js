#!/usr/bin/env node

const INDEXER_URL = 'http://localhost:42069/graphql';

async function testIndexerConnection() {
  console.log('Testing indexer connection at:', INDEXER_URL);
  
  try {
    // Test basic connectivity
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          {
            cLOBOrders(
              where: { bookId: "1", status: "ACTIVE" }
              orderBy: "price"
              orderDirection: "desc"
            ) {
              items {
                id
                bookId
                price
                amount
                remaining
                orderType
                status
              }
            }
          }
        `
      })
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return false;
    }

    console.log('✅ Indexer connection successful!');
    console.log('Found', data.data.cLOBOrders.items.length, 'active orders');
    
    // Separate buy and sell orders
    const buyOrders = data.data.cLOBOrders.items.filter(o => o.orderType === 'BUY');
    const sellOrders = data.data.cLOBOrders.items.filter(o => o.orderType === 'SELL');
    
    console.log('\n📊 Order Book Summary:');
    console.log('Buy Orders:', buyOrders.length);
    console.log('Sell Orders:', sellOrders.length);
    
    if (sellOrders.length > 0) {
      const lowestAsk = sellOrders.sort((a, b) => BigInt(a.price) - BigInt(b.price))[0];
      console.log('Best Ask:', Number(lowestAsk.price) / 1e6, 'USDC');
    }
    
    if (buyOrders.length > 0) {
      const highestBid = buyOrders.sort((a, b) => BigInt(b.price) - BigInt(a.price))[0];
      console.log('Best Bid:', Number(highestBid.price) / 1e6, 'USDC');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to indexer:', error.message);
    return false;
  }
}

// Run the test
testIndexerConnection().then(success => {
  process.exit(success ? 0 : 1);
});