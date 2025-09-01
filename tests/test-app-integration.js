import { createPublicClient, http, parseUnits, formatUnits } from 'viem';

const RPC_URL = 'https://indexing.testnet.riselabs.xyz';
const INDEXER_URL = 'http://192.168.0.194:42069';
const CHAIN_ID = 11155931;

const publicClient = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: 'RISE Testnet',
    network: 'rise-testnet',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: {
      default: { http: [RPC_URL] },
      public: { http: [RPC_URL] },
    },
  },
  transport: http(RPC_URL),
});

async function testIndexerQuery(query, description) {
  console.log(`\n📊 Testing: ${description}`);
  try {
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
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
  console.log('🔍 Testing Mobile App Integration');
  console.log('==================================\n');
  
  console.log('📡 Checking Indexer Status');
  console.log('--------------------------');
  
  // Test 1: Order Book Query (as used by mobile app)
  const orderBookQuery = `{
    buyOrders: cLOBOrders(
      where: { bookId: "1", orderType: "BUY", status_in: ["ACTIVE", "PARTIALLY_FILLED"] }
      orderBy: "price"
      orderDirection: "desc"
      limit: 20
    ) {
      items {
        id
        price
        remaining
      }
    }
    sellOrders: cLOBOrders(
      where: { bookId: "1", orderType: "SELL", status_in: ["ACTIVE", "PARTIALLY_FILLED"] }
      orderBy: "price"
      orderDirection: "asc"
      limit: 20
    ) {
      items {
        id
        price
        remaining
      }
    }
  }`;
  
  const orderBook = await testIndexerQuery(orderBookQuery, 'Order Book Query');
  if (orderBook) {
    console.log(`  📈 Buy orders: ${orderBook.buyOrders.items.length}`);
    console.log(`  📉 Sell orders: ${orderBook.sellOrders.items.length}`);
    
    if (orderBook.buyOrders.items.length > 0) {
      const bestBid = orderBook.buyOrders.items[0];
      console.log(`  💰 Best bid: $${formatUnits(BigInt(bestBid.price), 6)}`);
    }
    
    if (orderBook.sellOrders.items.length > 0) {
      const bestAsk = orderBook.sellOrders.items[0];
      console.log(`  💸 Best ask: $${formatUnits(BigInt(bestAsk.price), 6)}`);
    }
  }
  
  // Test 2: User Balances Query
  const balancesQuery = `{
    userBalances {
      items {
        id
        token
        available
        locked
        totalDeposited
        totalWithdrawn
      }
    }
  }`;
  
  const balances = await testIndexerQuery(balancesQuery, 'User Balances Query');
  if (balances) {
    console.log(`  💼 Total user balances: ${balances.userBalances.items.length}`);
  }
  
  // Test 3: Recent Trades Query
  const tradesQuery = `{
    trades(
      limit: 10
      orderBy: "timestamp"
      orderDirection: "desc"
    ) {
      items {
        id
        price
        amount
        timestamp
        blockNumber
      }
    }
  }`;
  
  const trades = await testIndexerQuery(tradesQuery, 'Recent Trades Query');
  if (trades) {
    console.log(`  📊 Recent trades: ${trades.trades.items.length}`);
  }
  
  // Test 4: Trading Books Query
  const booksQuery = `{
    tradingBooks {
      items {
        id
        baseToken
        quoteToken
        name
        active
        lastPrice
        volume24h
      }
    }
  }`;
  
  const books = await testIndexerQuery(booksQuery, 'Trading Books Query');
  if (books) {
    console.log(`  📚 Trading books: ${books.tradingBooks.items.length}`);
    books.tradingBooks.items.forEach(book => {
      console.log(`     Book ${book.id}: ${book.name} (${book.active ? 'Active' : 'Inactive'})`);
    });
  }
  
  // Test 5: Check CLOB Contract
  console.log('\n🔗 Checking CLOB Contract');
  console.log('-------------------------');
  
  const CLOB_ADDRESS = '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C';
  const bytecode = await publicClient.getBytecode({ address: CLOB_ADDRESS });
  console.log(`  Contract deployed: ${bytecode && bytecode.length > 2 ? '✅' : '❌'}`);
  
  // Summary
  console.log('\n📊 Integration Test Summary');
  console.log('==========================');
  
  const issues = [];
  
  if (!orderBook || orderBook.buyOrders.items.length === 0) {
    issues.push('No buy orders in order book');
  }
  
  if (!orderBook || orderBook.sellOrders.items.length === 0) {
    issues.push('No sell orders in order book');
  }
  
  if (!balances || balances.userBalances.items.length === 0) {
    issues.push('No user balances tracked');
  }
  
  if (!trades || trades.trades.items.length === 0) {
    issues.push('No trades recorded');
  }
  
  if (!books || books.tradingBooks.items.length === 0) {
    issues.push('No trading books configured');
  }
  
  if (issues.length === 0) {
    console.log('✅ All systems operational!');
    console.log('\nThe mobile app should be able to:');
    console.log('  • Display order book with buy/sell orders');
    console.log('  • Show user balances (once deposited)');
    console.log('  • Display recent trades (once executed)');
    console.log('  • Access trading book information');
  } else {
    console.log('⚠️  Found issues:');
    issues.forEach(issue => console.log(`  • ${issue}`));
    
    console.log('\n💡 Recommendations:');
    if (issues.includes('No user balances tracked')) {
      console.log('  • Deposit tokens to CLOB to see balances');
    }
    if (issues.includes('No trades recorded')) {
      console.log('  • Execute market orders or match limit orders to create trades');
    }
    if (issues.includes('No trading books configured')) {
      console.log('  • Check if BookCreated events are being indexed');
    }
  }
  
  console.log('\n🎯 Mobile App Connection Info:');
  console.log(`  Indexer URL: ${INDEXER_URL}`);
  console.log(`  Make sure mobile .env has: EXPO_PUBLIC_INDEXER_URL=${INDEXER_URL}`);
}

main().catch(console.error);