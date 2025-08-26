import { gql } from 'graphql-request';

// Query for recent trades in a market
export const GET_RECENT_TRADES = gql`
  query GetRecentTrades($market: String!, $limit: Int = 50) {
    trades(
      where: { market: $market }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        buyOrderId
        sellOrderId
        buyer
        seller
        maker
        taker
        price
        amount
        quoteVolume
        makerFee
        takerFee
        timestamp
        blockNumber
        transactionHash
      }
      totalCount
    }
  }
`;

// Query for price candles (OHLCV data)
export const GET_PRICE_CANDLES = gql`
  query GetPriceCandles(
    $market: String!
    $interval: String!
    $from: Int
    $to: Int
    $limit: Int = 100
  ) {
    priceCandles(
      where: { 
        market: $market
        interval: $interval
      }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        timestamp
        open
        high
        low
        close
        volume
        trades
      }
    }
  }
`;

// Query for user's trade history
export const GET_USER_TRADES = gql`
  query GetUserTrades($trader: String!, $limit: Int = 50) {
    userTrades(
      where: { 
        trader: $trader
      }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        orderId
        trader {
          address
        }
        market {
          address
          name
          baseToken
          quoteToken
        }
        side
        role
        price
        amount
        fee
        timestamp
      }
    }
  }
`;

// Query for hourly volume data
export const GET_HOURLY_VOLUME = gql`
  query GetHourlyVolume($market: String!, $hours: Int = 24) {
    hourlyVolumes(
      where: { market: $market }
      orderBy: "hourTimestamp"
      orderDirection: "desc"
      limit: $hours
    ) {
      items {
        id
        hourTimestamp
        volume
        trades
        high
        low
        open
        close
      }
    }
  }
`;