import { gql } from 'graphql-request';

// Query for active orders to build order book
export const GET_ACTIVE_ORDERS = gql`
  query GetActiveOrders($market: String!, $limit: Int = 100) {
    activeOrders(
      where: { market: $market }
      orderBy: "price"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        orderId
        trader {
          address
        }
        isBuy
        price
        originalAmount
        remainingAmount
        timestamp
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

// Query for aggregated price levels
export const GET_PRICE_LEVELS = gql`
  query GetPriceLevels($market: String!, $limit: Int = 20) {
    # Get buy side (bids)
    bids: priceLevels(
      where: { market: $market, isBuy: true }
      orderBy: "price"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        price
        totalAmount
        orderCount
        lastUpdate
      }
    }
    
    # Get sell side (asks)
    asks: priceLevels(
      where: { market: $market, isBuy: false }
      orderBy: "price"
      orderDirection: "asc"
      limit: $limit
    ) {
      items {
        id
        price
        totalAmount
        orderCount
        lastUpdate
      }
    }
  }
`;

// Query for market price info
export const GET_MARKET_PRICE = gql`
  query GetMarketPrice($market: String!) {
    marketPrices(where: { market: $market }, limit: 1) {
      items {
        lastPrice
        lastTradeId
        lastTradeTimestamp
        priceChange24h
        priceChange1h
      }
    }
  }
`;

// Query for 24h market stats
export const GET_MARKET_STATS = gql`
  query GetMarketStats($market: String!) {
    market24hStatss(where: { market: $market }, limit: 1) {
      items {
        volume24h
        trades24h
        high24h
        low24h
        lastUpdate
      }
    }
  }
`;

// Combined query for complete order book data
export const GET_ORDER_BOOK_DATA = gql`
  query GetOrderBookData($market: String!, $limit: Int = 20) {
    # Active orders for detailed view
    activeOrders(
      where: { market: $market }
      orderBy: "price"
      orderDirection: "desc"
      limit: 100
    ) {
      items {
        id
        orderId
        trader {
          address
        }
        isBuy
        price
        originalAmount
        remainingAmount
        timestamp
      }
    }
    
    # Market price info
    marketPrices(where: { market: $market }, limit: 1) {
      items {
        lastPrice
        priceChange24h
        priceChange1h
      }
    }
    
    # 24h stats
    market24hStatss(where: { market: $market }, limit: 1) {
      items {
        volume24h
        trades24h
        high24h
        low24h
      }
    }
  }
`;