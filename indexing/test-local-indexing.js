import { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const INDEXER_URL = 'http://localhost:42069/graphql';

// Wait for the indexer to be ready
const waitForIndexer = async () => {
  const client = new GraphQLClient(INDEXER_URL);
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds timeout
  
  while (attempts < maxAttempts) {
    try {
      // Try a simple query to check if server is ready
      await client.request(gql`
        query {
          __typename
        }
      `);
      console.log('✅ Indexer is ready!');
      return true;
    } catch (error) {
      attempts++;
      console.log(`Waiting for indexer... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Indexer failed to start');
};

// Test queries
const testQueries = async () => {
  const client = new GraphQLClient(INDEXER_URL);
  
  console.log('\n📊 Testing GraphQL Queries...\n');
  
  // Query 1: Get trading books
  try {
    const booksQuery = gql`
      query GetTradingBooks {
        tradingBooks {
          items {
            id
            name
            baseToken
            quoteToken
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
    
    const booksResult = await client.request(booksQuery);
    console.log('📚 Trading Books:', JSON.stringify(booksResult, null, 2));
  } catch (error) {
    console.log('❌ Failed to query trading books:', error.message);
  }
  
  // Query 2: Get recent orders
  try {
    const ordersQuery = gql`
      query GetRecentOrders {
        clobOrders(orderBy: "timestamp", orderDirection: "desc", limit: 10) {
          items {
            id
            trader
            bookId
            orderType
            price
            amount
            filled
            remaining
            status
            timestamp
          }
        }
      }
    `;
    
    const ordersResult = await client.request(ordersQuery);
    console.log('\n📋 Recent Orders:', JSON.stringify(ordersResult, null, 2));
  } catch (error) {
    console.log('❌ Failed to query orders:', error.message);
  }
  
  // Query 3: Get recent trades
  try {
    const tradesQuery = gql`
      query GetRecentTrades {
        tradeV2s(orderBy: "timestamp", orderDirection: "desc", limit: 10) {
          items {
            id
            bookId
            buyer
            seller
            price
            amount
            buyerFee
            sellerFee
            timestamp
          }
        }
      }
    `;
    
    const tradesResult = await client.request(tradesQuery);
    console.log('\n💹 Recent Trades:', JSON.stringify(tradesResult, null, 2));
  } catch (error) {
    console.log('❌ Failed to query trades:', error.message);
  }
  
  // Query 4: Get user balances
  try {
    const balancesQuery = gql`
      query GetUserBalances {
        userBalances(limit: 10) {
          items {
            id
            user
            token
            available
            locked
            totalDeposited
            totalWithdrawn
          }
        }
      }
    `;
    
    const balancesResult = await client.request(balancesQuery);
    console.log('\n💰 User Balances:', JSON.stringify(balancesResult, null, 2));
  } catch (error) {
    console.log('❌ Failed to query balances:', error.message);
  }
  
  // Query 5: Get market stats
  try {
    const statsQuery = gql`
      query GetMarketStats {
        marketStats {
          items {
            id
            bookId
            period
            high
            low
            open
            close
            volume
            trades
          }
        }
      }
    `;
    
    const statsResult = await client.request(statsQuery);
    console.log('\n📈 Market Stats:', JSON.stringify(statsResult, null, 2));
  } catch (error) {
    console.log('❌ Failed to query market stats:', error.message);
  }
};

// Main function
const main = async () => {
  console.log('🚀 Testing Ponder Indexer...\n');
  
  try {
    await waitForIndexer();
    await testQueries();
    
    console.log('\n✨ Indexing test complete!');
    console.log('\n📝 GraphQL Playground available at:', INDEXER_URL);
    console.log('You can explore the schema and run custom queries there.\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

main();