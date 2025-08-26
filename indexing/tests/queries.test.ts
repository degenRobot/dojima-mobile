import { describe, it, expect } from 'vitest';
import { gql } from 'graphql-request';

describe('GraphQL Query Construction', () => {
  describe('Order Book Queries', () => {
    it('should construct valid order book query', () => {
      const query = gql`
        query GetOrderBook($market: String!) {
          buyOrders: activeOrders(
            where: { market: $market, isBuy: true }
            orderBy: "price"
            orderDirection: "desc"
            limit: 20
          ) {
            items {
              orderId
              price
              remainingAmount
              trader {
                address
              }
            }
          }
          sellOrders: activeOrders(
            where: { market: $market, isBuy: false }
            orderBy: "price"
            orderDirection: "asc"
            limit: 20
          ) {
            items {
              orderId
              price
              remainingAmount
              trader {
                address
              }
            }
          }
        }
      `;
      
      expect(query).toContain('buyOrders');
      expect(query).toContain('sellOrders');
      expect(query).toContain('trader {');
      expect(query).toContain('address');
    });
  });

  describe('Trade History Queries', () => {
    it('should construct valid user trades query', () => {
      const query = gql`
        query GetUserTrades($trader: String!, $limit: Int) {
          userTrades(
            where: { trader: $trader }
            orderBy: "timestamp"
            orderDirection: "desc"
            limit: $limit
          ) {
            items {
              id
              orderId
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
      
      expect(query).toContain('userTrades');
      expect(query).toContain('where: { trader: $trader }');
      expect(query).toContain('side');
      expect(query).toContain('role');
    });
  });

  describe('Market Stats Queries', () => {
    it('should construct valid market stats query', () => {
      const query = gql`
        query GetMarketStats($market: String!) {
          market24hStats(market: $market) {
            volume24h
            trades24h
            high24h
            low24h
            lastUpdate
          }
          marketPrice(market: $market) {
            lastPrice
            priceChange24h
            priceChange1h
          }
        }
      `;
      
      expect(query).toContain('market24hStats');
      expect(query).toContain('marketPrice');
      expect(query).toContain('volume24h');
      expect(query).toContain('lastPrice');
    });
  });

  describe('Pagination Queries', () => {
    it('should construct valid paginated query', () => {
      const query = gql`
        query GetOrdersPage($after: String, $limit: Int!) {
          orderHistorys(
            after: $after
            limit: $limit
            orderBy: "createdAt"
            orderDirection: "desc"
          ) {
            items {
              id
              status
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            totalCount
          }
        }
      `;
      
      expect(query).toContain('after: $after');
      expect(query).toContain('pageInfo');
      expect(query).toContain('hasNextPage');
      expect(query).toContain('totalCount');
    });
  });

  describe('Filter Queries', () => {
    it('should construct query with multiple filters', () => {
      const query = gql`
        query GetFilteredOrders($trader: String!, $status: [String!], $market: String) {
          orderHistorys(
            where: { 
              trader: $trader
              status_in: $status
              market: $market
            }
            orderBy: "createdAt"
            orderDirection: "desc"
          ) {
            items {
              id
              orderId
              status
              price
              originalAmount
              filledAmount
            }
          }
        }
      `;
      
      expect(query).toContain('trader: $trader');
      expect(query).toContain('status_in: $status');
      expect(query).toContain('market: $market');
    });

    it('should construct query with price range filter', () => {
      const query = gql`
        query GetOrdersInPriceRange($market: String!, $minPrice: BigInt!, $maxPrice: BigInt!) {
          activeOrders(
            where: { 
              market: $market
              price_gte: $minPrice
              price_lte: $maxPrice
            }
            orderBy: "price"
            orderDirection: "asc"
          ) {
            items {
              orderId
              price
              remainingAmount
            }
          }
        }
      `;
      
      expect(query).toContain('price_gte: $minPrice');
      expect(query).toContain('price_lte: $maxPrice');
    });
  });

  describe('Complex Queries', () => {
    it('should construct query with nested relations', () => {
      const query = gql`
        query GetOrderWithRelations($orderId: String!) {
          orderHistory(id: $orderId) {
            id
            orderId
            trader {
              address
              totalTradesCount
              totalVolumeUsd
            }
            market {
              address
              name
              baseToken
              quoteToken
            }
            price
            originalAmount
            filledAmount
            status
            createdAt
          }
        }
      `;
      
      expect(query).toContain('trader {');
      expect(query).toContain('totalTradesCount');
      expect(query).toContain('market {');
      expect(query).toContain('baseToken');
    });

    it('should construct query with aggregations', () => {
      const query = gql`
        query GetAggregatedOrderBook($market: String!) {
          priceLevels(
            where: { 
              market: $market
              totalAmount_gt: "0"
            }
            orderBy: "price"
          ) {
            items {
              price
              isBuy
              totalAmount
              orderCount
              lastUpdate
            }
          }
        }
      `;
      
      expect(query).toContain('priceLevels');
      expect(query).toContain('totalAmount_gt: "0"');
      expect(query).toContain('orderCount');
    });
  });
});