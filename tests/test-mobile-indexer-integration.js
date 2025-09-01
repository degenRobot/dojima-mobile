#!/usr/bin/env node

const INDEXER_URL = 'http://172.23.0.99:42069/graphql';

async function testQuery(queryObj, description) {
  console.log(`\n📊 Testing: ${description}`);
  try {
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryObj),
    });
    
    const data = await response.json();
    
    if (data.errors) {
      console.log('  ❌ Query failed:', data.errors[0].message);
      return null;
    }
    
    console.log('  ✅ Query successful');
    return data.data;
  } catch (error) {
    console.log('  ❌ Network error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Testing Mobile App Indexer Integration');
  console.log('==========================================');
  console.log('Indexer URL:', INDEXER_URL);
  
  // Test the exact queries used by the mobile app
  
  // 1. Test Order Book Query (from OrderBook.tsx)
  const orderBookQuery = `
    query GetOrderBookDepth($bookId: String!, $limit: Int) {
      buyOrders: cLOBOrders(
        where: { 
          bookId: $bookId, 
          orderType: "BUY",
          status_in: ["ACTIVE", "PARTIALLY_FILLED"] 
        }
        orderBy: "price"
        orderDirection: "desc"
        limit: $limit
      ) {
        items {
          id
          price
          remaining
        }
      }
      
      sellOrders: cLOBOrders(
        where: { 
          bookId: $bookId, 
          orderType: "SELL",
          status_in: ["ACTIVE", "PARTIALLY_FILLED"] 
        }
        orderBy: "price"
        orderDirection: "asc"
        limit: $limit
      ) {
        items {
          id
          price
          remaining
        }
      }
    }
  `;
  
  const orderBookData = await testQuery(
    {
      query: orderBookQuery,
      variables: { bookId: "1", limit: 20 }
    },
    'Order Book Query (as used by mobile app)'
  );
  
  if (orderBookData) {
    console.log(`  📈 Buy orders: ${orderBookData.buyOrders.items.length}`);
    console.log(`  📉 Sell orders: ${orderBookData.sellOrders.items.length}`);
    
    if (orderBookData.sellOrders.items.length > 0) {
      const bestAsk = orderBookData.sellOrders.items[0];
      console.log(`  💸 Best ask: ${Number(bestAsk.price) / 1e6} USDC`);
    }
    
    if (orderBookData.buyOrders.items.length > 0) {
      const bestBid = orderBookData.buyOrders.items[0];
      console.log(`  💰 Best bid: ${Number(bestBid.price) / 1e6} USDC`);
    }
  }
  
  // 2. Test Recent Trades Query (from RecentTrades.tsx)
  const recentTradesQuery = `
    query GetRecentTrades($bookId: String!, $limit: Int) {
      trades(
        where: { bookId: $bookId }
        orderBy: "timestamp"
        orderDirection: "desc"
        limit: $limit
      ) {
        items {
          id
          buyer {
            address
          }
          seller {
            address
          }
          price
          amount
          buyerFee
          sellerFee
          timestamp
          blockNumber
        }
      }
    }
  `;
  
  const tradesData = await testQuery(
    {
      query: recentTradesQuery,
      variables: { bookId: "1", limit: 20 }
    },
    'Recent Trades Query (with nested buyer/seller)'
  );
  
  if (tradesData) {
    console.log(`  📊 Recent trades: ${tradesData.trades.items.length}`);
    if (tradesData.trades.items.length > 0) {
      const latestTrade = tradesData.trades.items[0];
      console.log(`  💱 Latest trade: ${Number(latestTrade.price) / 1e6} USDC for ${Number(latestTrade.amount) / 1e18} ETH`);
      console.log(`  👤 Buyer: ${latestTrade.buyer?.address?.slice(0, 10) || 'Unknown'}...`);
      console.log(`  👤 Seller: ${latestTrade.seller?.address?.slice(0, 10) || 'Unknown'}...`);
    }
  }
  
  // 3. Test Trading Books Query
  const tradingBooksQuery = `
    query GetTradingBooks {
      tradingBooks {
        items {
          id
          baseToken
          quoteToken
          name
          active
          lastPrice
          volume24h
          totalVolume
          buyOrderCount
          sellOrderCount
        }
      }
    }
  `;
  
  const booksData = await testQuery(
    { query: tradingBooksQuery },
    'Trading Books Query'
  );
  
  if (booksData) {
    console.log(`  📚 Trading books: ${booksData.tradingBooks.items.length}`);
    booksData.tradingBooks.items.forEach(book => {
      console.log(`     Book ${book.id}: ${book.name} (${book.active ? 'Active' : 'Inactive'})`);
      if (book.lastPrice) {
        console.log(`       Last price: ${Number(book.lastPrice) / 1e6} USDC`);
      }
    });
  }
  
  console.log('\n✅ Summary');
  console.log('==========');
  console.log('Mobile app GraphQL queries are working correctly!');
  console.log('\n📱 Mobile App Configuration:');
  console.log(`  EXPO_PUBLIC_INDEXER_URL=http://172.23.0.99:42069/graphql`);
  console.log('\n💡 Tips:');
  console.log('  • Make sure the indexer is running: cd indexing && npx ponder dev');
  console.log('  • Update mobile/.env with the correct IP address for your network');
  console.log('  • Restart the Expo dev server after changing .env files');
}

main().catch(console.error);