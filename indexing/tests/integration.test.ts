import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphQLClient } from 'graphql-request';
import { spawn, ChildProcess } from 'child_process';
import { gql } from 'graphql-request';

const INDEXER_URL = 'http://localhost:42069';
const client = new GraphQLClient(INDEXER_URL);

let indexerProcess: ChildProcess;

// Helper to wait for indexer to be ready
async function waitForIndexer(maxAttempts = 30, delay = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await client.request(gql`{ _meta { status } }`);
      console.log('Indexer is ready');
      return true;
    } catch (error) {
      console.log(`Waiting for indexer... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Indexer failed to start');
}

describe('CLOB Indexer Integration Tests', () => {
  beforeAll(async () => {
    console.log('Starting indexer...');
    indexerProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      env: { ...process.env, PONDER_RPC_URL_1: 'https://testnet.riselabs.xyz' },
      stdio: 'pipe',
    });

    // Log indexer output for debugging
    indexerProcess.stdout?.on('data', (data) => {
      console.log(`[Indexer]: ${data}`);
    });
    indexerProcess.stderr?.on('data', (data) => {
      console.error(`[Indexer Error]: ${data}`);
    });

    await waitForIndexer();
  }, 60000); // 60 second timeout for startup

  afterAll(async () => {
    console.log('Stopping indexer...');
    indexerProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Basic Connectivity', () => {
    it('should connect to GraphQL endpoint', async () => {
      const query = gql`
        query {
          _meta {
            status
          }
        }
      `;
      const response = await client.request(query);
      expect(response._meta).toBeDefined();
      expect(response._meta.status).toBeDefined();
    });
  });

  describe('Market Queries', () => {
    it('should query markets', async () => {
      const query = gql`
        query {
          markets(limit: 10) {
            items {
              address
              pairId
              type
              baseToken
              quoteToken
              name
              isActive
            }
          }
        }
      `;
      const response = await client.request<{ markets: { items: any[] } }>(query);
      expect(response.markets).toBeDefined();
      expect(response.markets.items).toBeInstanceOf(Array);
    });

    it('should query market stats', async () => {
      const marketAddress = '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222';
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
      const response = await client.request(query, { market: marketAddress.toLowerCase() });
      // Stats might be null if no trades in 24h
      expect(response).toBeDefined();
    });
  });

  describe('Order Book Queries', () => {
    it('should query active orders', async () => {
      const query = gql`
        query {
          activeOrders(limit: 10) {
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
        }
      `;
      const response = await client.request<{ activeOrders: { items: any[] } }>(query);
      expect(response.activeOrders).toBeDefined();
      expect(response.activeOrders.items).toBeInstanceOf(Array);
    });

    it('should query order book by market', async () => {
      const marketAddress = '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222';
      const query = gql`
        query GetOrderBook($market: String!) {
          buyOrders: activeOrders(
            where: { market: $market, isBuy: true }
            orderBy: "price"
            orderDirection: "desc"
            limit: 10
          ) {
            items {
              orderId
              price
              remainingAmount
            }
          }
          sellOrders: activeOrders(
            where: { market: $market, isBuy: false }
            orderBy: "price"
            orderDirection: "asc"
            limit: 10
          ) {
            items {
              orderId
              price
              remainingAmount
            }
          }
        }
      `;
      const response = await client.request<{
        buyOrders: { items: any[] };
        sellOrders: { items: any[] };
      }>(query, { market: marketAddress.toLowerCase() });
      
      expect(response.buyOrders).toBeDefined();
      expect(response.sellOrders).toBeDefined();
      expect(response.buyOrders.items).toBeInstanceOf(Array);
      expect(response.sellOrders.items).toBeInstanceOf(Array);
    });
  });

  describe('Order History Queries', () => {
    it('should query order history', async () => {
      const query = gql`
        query {
          orderHistorys(limit: 10) {
            items {
              id
              orderId
              trader {
                address
              }
              market {
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
            }
          }
        }
      `;
      const response = await client.request<{ orderHistorys: { items: any[] } }>(query);
      expect(response.orderHistorys).toBeDefined();
      expect(response.orderHistorys.items).toBeInstanceOf(Array);
      
      // Verify data structure if we have orders
      if (response.orderHistorys.items.length > 0) {
        const order = response.orderHistorys.items[0];
        expect(order.id).toBeDefined();
        expect(order.trader).toBeDefined();
        expect(order.trader.address).toBeDefined();
        expect(order.status).toMatch(/^(ACTIVE|FILLED|PARTIALLY_FILLED|CANCELLED)$/);
      }
    });

    it('should filter orders by trader', async () => {
      const traderAddress = '0xcc86703cc131f65742ca555bab3d7e73a41635c4';
      const query = gql`
        query GetUserOrders($trader: String!) {
          orderHistorys(
            where: { trader: $trader }
            limit: 10
          ) {
            items {
              id
              orderId
              status
            }
          }
        }
      `;
      const response = await client.request<{ orderHistorys: { items: any[] } }>(
        query,
        { trader: traderAddress.toLowerCase() }
      );
      expect(response.orderHistorys).toBeDefined();
      expect(response.orderHistorys.items).toBeInstanceOf(Array);
    });

    it('should filter open orders', async () => {
      const query = gql`
        query {
          orderHistorys(
            where: { status_in: ["ACTIVE", "PARTIALLY_FILLED"] }
            limit: 10
          ) {
            items {
              id
              status
              originalAmount
              filledAmount
            }
          }
        }
      `;
      const response = await client.request<{ orderHistorys: { items: any[] } }>(query);
      expect(response.orderHistorys).toBeDefined();
      expect(response.orderHistorys.items).toBeInstanceOf(Array);
      
      // Verify all returned orders are open
      response.orderHistorys.items.forEach(order => {
        expect(['ACTIVE', 'PARTIALLY_FILLED']).toContain(order.status);
      });
    });
  });

  describe('Trade Queries', () => {
    it('should query recent trades', async () => {
      const query = gql`
        query {
          trades(
            orderBy: "timestamp"
            orderDirection: "desc"
            limit: 10
          ) {
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
              maker
              taker
            }
          }
        }
      `;
      const response = await client.request<{ trades: { items: any[] } }>(query);
      expect(response.trades).toBeDefined();
      expect(response.trades.items).toBeInstanceOf(Array);
      
      // Verify trades are sorted by timestamp (descending)
      if (response.trades.items.length > 1) {
        for (let i = 1; i < response.trades.items.length; i++) {
          expect(response.trades.items[i - 1].timestamp).toBeGreaterThanOrEqual(
            response.trades.items[i].timestamp
          );
        }
      }
    });

    it('should query user trades', async () => {
      const query = gql`
        query {
          userTrades(limit: 10) {
            items {
              id
              trader {
                address
              }
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
      const response = await client.request<{ userTrades: { items: any[] } }>(query);
      expect(response.userTrades).toBeDefined();
      expect(response.userTrades.items).toBeInstanceOf(Array);
      
      // Verify data structure if we have trades
      if (response.userTrades.items.length > 0) {
        const trade = response.userTrades.items[0];
        expect(['BUY', 'SELL']).toContain(trade.side);
        expect(['MAKER', 'TAKER']).toContain(trade.role);
      }
    });
  });

  describe('Balance Queries', () => {
    it('should query user balances', async () => {
      const query = gql`
        query {
          balances(limit: 10) {
            items {
              id
              user {
                address
              }
              market {
                address
              }
              token
              available
              locked
              total
              lastUpdate
            }
          }
        }
      `;
      const response = await client.request<{ balances: { items: any[] } }>(query);
      expect(response.balances).toBeDefined();
      expect(response.balances.items).toBeInstanceOf(Array);
      
      // Verify balance calculations if we have data
      if (response.balances.items.length > 0) {
        const balance = response.balances.items[0];
        const total = BigInt(balance.total);
        const available = BigInt(balance.available);
        const locked = BigInt(balance.locked);
        expect(total).toBe(available + locked);
      }
    });
  });

  describe('Deposit/Withdrawal Queries', () => {
    it('should query deposits', async () => {
      const query = gql`
        query {
          deposits(
            orderBy: "timestamp"
            orderDirection: "desc"
            limit: 10
          ) {
            items {
              id
              user {
                address
              }
              market {
                address
              }
              token
              amount
              timestamp
              transactionHash
            }
          }
        }
      `;
      const response = await client.request<{ deposits: { items: any[] } }>(query);
      expect(response.deposits).toBeDefined();
      expect(response.deposits.items).toBeInstanceOf(Array);
    });

    it('should query withdrawals', async () => {
      const query = gql`
        query {
          withdrawals(
            orderBy: "timestamp"
            orderDirection: "desc"
            limit: 10
          ) {
            items {
              id
              user {
                address
              }
              market {
                address
              }
              token
              amount
              timestamp
              transactionHash
            }
          }
        }
      `;
      const response = await client.request<{ withdrawals: { items: any[] } }>(query);
      expect(response.withdrawals).toBeDefined();
      expect(response.withdrawals.items).toBeInstanceOf(Array);
    });
  });

  describe('Pagination', () => {
    it('should paginate results', async () => {
      const query = gql`
        query GetOrdersPage($after: String) {
          orderHistorys(limit: 5, after: $after) {
            items {
              id
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;
      
      // First page
      const firstPage = await client.request<{
        orderHistorys: {
          items: any[];
          pageInfo: { hasNextPage: boolean; endCursor: string };
        };
      }>(query);
      
      expect(firstPage.orderHistorys).toBeDefined();
      expect(firstPage.orderHistorys.items).toBeInstanceOf(Array);
      
      // Second page if available
      if (firstPage.orderHistorys.pageInfo.hasNextPage) {
        const secondPage = await client.request<{
          orderHistorys: { items: any[] };
        }>(query, { after: firstPage.orderHistorys.pageInfo.endCursor });
        
        expect(secondPage.orderHistorys.items).toBeInstanceOf(Array);
        // Verify no duplicate IDs
        const firstPageIds = firstPage.orderHistorys.items.map(item => item.id);
        const secondPageIds = secondPage.orderHistorys.items.map(item => item.id);
        const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(intersection).toHaveLength(0);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should have consistent relationships', async () => {
      const query = gql`
        query {
          trades(limit: 5) {
            items {
              id
              buyer {
                address
              }
              seller {
                address
              }
              market {
                address
                name
              }
            }
          }
        }
      `;
      const response = await client.request<{ trades: { items: any[] } }>(query);
      
      // Verify all trades have valid buyer/seller/market relationships
      response.trades.items.forEach(trade => {
        expect(trade.buyer).toBeDefined();
        expect(trade.buyer.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(trade.seller).toBeDefined();
        expect(trade.seller.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(trade.market).toBeDefined();
        expect(trade.market.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('should have valid BigInt values', async () => {
      const query = gql`
        query {
          orderHistorys(limit: 5) {
            items {
              price
              originalAmount
              filledAmount
            }
          }
        }
      `;
      const response = await client.request<{ orderHistorys: { items: any[] } }>(query);
      
      response.orderHistorys.items.forEach(order => {
        // Verify BigInt strings can be parsed
        expect(() => BigInt(order.price)).not.toThrow();
        expect(() => BigInt(order.originalAmount)).not.toThrow();
        expect(() => BigInt(order.filledAmount)).not.toThrow();
        
        // Verify filled amount doesn't exceed original
        const original = BigInt(order.originalAmount);
        const filled = BigInt(order.filledAmount);
        expect(filled).toBeLessThanOrEqual(original);
      });
    });
  });
});