import { gql } from 'graphql-request';

// ============================================
// ORDER BOOK QUERIES
// ============================================

export const GET_ORDER_BOOK = gql`
  query GetOrderBook($bookId: String!) {
    clobOrders(
      where: { 
        bookId: $bookId, 
        status_in: ["ACTIVE", "PARTIALLY_FILLED"] 
      }
    ) {
      items {
        id
        trader
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

export const GET_ORDER_BOOK_DEPTH = gql`
  query GetOrderBookDepth($bookId: String!, $limit: Int = 20) {
    buyOrders: clobOrders(
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
    
    sellOrders: clobOrders(
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

// ============================================
// USER QUERIES
// ============================================

export const GET_USER_ORDERS = gql`
  query GetUserOrders($user: String!, $status: String) {
    clobOrders(
      where: { 
        trader: $user
        ${status ? ', status: $status' : ''}
      }
      orderBy: "timestamp"
      orderDirection: "desc"
    ) {
      items {
        id
        bookId
        orderType
        price
        amount
        filled
        remaining
        status
        timestamp
        txHash
      }
    }
  }
`;

export const GET_USER_TRADES = gql`
  query GetUserTrades($user: String!, $limit: Int = 50) {
    buyTrades: tradeV2s(
      where: { buyer: $user }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        bookId
        price
        amount
        buyerFee
        timestamp
        txHash
      }
    }
    
    sellTrades: tradeV2s(
      where: { seller: $user }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        bookId
        price
        amount
        sellerFee
        timestamp
        txHash
      }
    }
  }
`;

export const GET_USER_BALANCES = gql`
  query GetUserBalances($user: String!) {
    userBalances(where: { user: $user }) {
      items {
        id
        token
        available
        locked
        totalDeposited
        totalWithdrawn
        lastUpdated
      }
    }
  }
`;

export const GET_USER_ACTIVITY = gql`
  query GetUserActivity($user: String!, $limit: Int = 100) {
    userActivities(
      where: { user: $user }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        activityType
        bookId
        orderId
        token
        amount
        price
        timestamp
        txHash
      }
    }
  }
`;

// ============================================
// MARKET QUERIES
// ============================================

export const GET_TRADING_BOOKS = gql`
  query GetTradingBooks($active: Boolean) {
    tradingBooks(
      where: { ${active !== undefined ? 'active: $active' : ''} }
    ) {
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
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_MARKET_STATS = gql`
  query GetMarketStats($bookId: String!, $period: String!) {
    marketStats(
      where: { bookId: $bookId, period: $period }
    ) {
      items {
        id
        high
        low
        open
        close
        volume
        trades
        timestamp
      }
    }
  }
`;

export const GET_RECENT_TRADES = gql`
  query GetRecentTrades($bookId: String!, $limit: Int = 50) {
    tradeV2s(
      where: { bookId: $bookId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        buyer
        seller
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

export const GET_PRICE_HISTORY = gql`
  query GetPriceHistory(
    $bookId: String!, 
    $fromTimestamp: Int!, 
    $toTimestamp: Int!
  ) {
    tradeV2s(
      where: { 
        bookId: $bookId,
        timestamp_gte: $fromTimestamp,
        timestamp_lte: $toTimestamp
      }
      orderBy: "timestamp"
      orderDirection: "asc"
    ) {
      items {
        price
        amount
        timestamp
      }
    }
  }
`;

// ============================================
// AGGREGATED QUERIES
// ============================================

export const GET_MARKET_OVERVIEW = gql`
  query GetMarketOverview {
    tradingBooks {
      items {
        id
        name
        lastPrice
        volume24h
      }
    }
    
    recentTrades: tradeV2s(
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: 10
    ) {
      items {
        bookId
        price
        amount
        timestamp
      }
    }
    
    stats24h: marketStats(where: { period: "24h" }) {
      items {
        bookId
        high
        low
        volume
        trades
      }
    }
  }
`;

export const GET_USER_DASHBOARD = gql`
  query GetUserDashboard($user: String!) {
    balances: userBalances(where: { user: $user }) {
      items {
        token
        available
        locked
      }
    }
    
    activeOrders: clobOrders(
      where: { 
        trader: $user,
        status_in: ["ACTIVE", "PARTIALLY_FILLED"]
      }
    ) {
      items {
        id
        bookId
        orderType
        price
        amount
        remaining
      }
    }
    
    recentActivity: userActivities(
      where: { user: $user }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: 5
    ) {
      items {
        activityType
        bookId
        amount
        timestamp
      }
    }
  }
`;

// ============================================
// SUBSCRIPTION FRAGMENTS (for future WebSocket)
// ============================================

export const ORDER_FRAGMENT = gql`
  fragment OrderFields on CLOBOrder {
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
`;

export const TRADE_FRAGMENT = gql`
  fragment TradeFields on Trade {
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
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

export const buildOrderBookQuery = (bookId: string, depth: number = 20) => ({
  query: GET_ORDER_BOOK_DEPTH,
  variables: { bookId, limit: depth }
});

export const buildUserOrdersQuery = (user: string, status?: string) => ({
  query: GET_USER_ORDERS,
  variables: { user, status }
});

export const buildMarketStatsQuery = (bookId: string, period: '1h' | '24h' | '7d') => ({
  query: GET_MARKET_STATS,
  variables: { bookId, period }
});

export const buildPriceHistoryQuery = (
  bookId: string, 
  hours: number = 24
) => {
  const toTimestamp = Math.floor(Date.now() / 1000);
  const fromTimestamp = toTimestamp - (hours * 3600);
  
  return {
    query: GET_PRICE_HISTORY,
    variables: { bookId, fromTimestamp, toTimestamp }
  };
};