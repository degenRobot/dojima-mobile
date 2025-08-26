import { gql } from 'graphql-request';

// Query for user's order history
export const GET_USER_ORDERS = gql`
  query GetUserOrders(
    $trader: String!
    $orderBy: String = "createdAt"
    $orderDirection: String = "desc"
    $limit: Int = 50
    $after: String
  ) {
    orderHistorys(
      where: { 
        trader: $trader
      }
      orderBy: $orderBy
      orderDirection: $orderDirection
      limit: $limit
      after: $after
    ) {
      items {
        id
        orderId
        market {
          address
          name
          baseToken
          quoteToken
        }
        trader {
          address
        }
        isBuy
        orderType
        price
        originalAmount
        filledAmount
        status
        createdAt
        updatedAt
        cancelledAt
        filledAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

// Query for user's open orders
export const GET_OPEN_ORDERS = gql`
  query GetOpenOrders($trader: String!) {
    orderHistorys(
      where: { 
        trader: $trader
        status_in: ["ACTIVE", "PARTIALLY_FILLED"]
      }
      orderBy: "createdAt"
      orderDirection: "desc"
    ) {
      items {
        id
        orderId
        market {
          address
          name
          baseToken
          quoteToken
        }
        trader {
          address
        }
        isBuy
        orderType
        price
        originalAmount
        filledAmount
        status
        createdAt
      }
      totalCount
    }
  }
`;

// Query for user's trade history
export const GET_USER_TRADES = gql`
  query GetUserTrades(
    $trader: String!
    $limit: Int = 50
    $after: String
  ) {
    userTrades(
      where: { 
        trader: $trader
      }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
      after: $after
    ) {
      items {
        id
        orderId
        side
        role
        price
        amount
        quoteAmount
        fee
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

// Query for order details
export const GET_ORDER_DETAILS = gql`
  query GetOrderDetails($id: String!) {
    orderHistory(id: $id) {
      id
      orderId
      isBuy
      orderType
      price
      originalAmount
      filledAmount
      status
      createdAt
      updatedAt
      cancelledAt
      filledAt
    }
  }
`;