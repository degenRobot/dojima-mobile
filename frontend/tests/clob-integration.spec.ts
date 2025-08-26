import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';

// Test wallet configuration
const TEST_PRIVATE_KEY = '0x99e8065d93229e87953669c23cc193f4bbebcdbb877ed272c66ee27a5cb75508';
const TEST_WALLET = new ethers.Wallet(TEST_PRIVATE_KEY);
const TEST_ADDRESS = TEST_WALLET.address;

// Contract addresses
const WETH_ADDRESS = '0x0da0E0657016533CB318570d519c62670A377748';
const USDC_ADDRESS = '0x71a1A92DEF5A4258788212c0Febb936041b5F6c1';
const ENHANCED_SPOT_BOOK = '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222';

// Helper to wait for indexer to catch up
async function waitForIndexer(ms = 3000) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

test.describe('CLOB Integration Tests', () => {
  test.beforeAll(async () => {
    console.log('Test wallet address:', TEST_ADDRESS);
    console.log('Make sure the wallet has ETH for gas and some test tokens');
  });

  test('should display real-time WebSocket events', async ({ page }) => {
    // Navigate to events page
    await page.goto('http://localhost:3000/events');
    
    // Check WebSocket connection status
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 10000 });
    
    // Check that EnhancedSpotBook is in the contract list
    await page.selectOption('select:has-text("All Contracts")', 'EnhancedSpotBook');
    await expect(page.locator('text=Contract: 0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222')).toBeVisible();
    
    // Reset to all contracts
    await page.selectOption('select:has-text("EnhancedSpotBook")', 'all');
  });

  test('should connect embedded wallet and show balance', async ({ page }) => {
    // Navigate to portfolio page
    await page.goto('http://localhost:3000/portfolio');
    
    // Click connect wallet
    await page.click('button:has-text("Connect Wallet")');
    
    // Select embedded wallet option
    await page.click('button:has-text("Embedded Wallet")');
    
    // Enter private key
    await page.fill('input[type="password"]', TEST_PRIVATE_KEY);
    await page.click('button:has-text("Import")');
    
    // Wait for wallet to connect
    await expect(page.locator(`text=${TEST_ADDRESS.slice(0, 6)}...${TEST_ADDRESS.slice(-4)}`)).toBeVisible({ timeout: 10000 });
    
    // Check balance is displayed
    await expect(page.locator('text=Balances')).toBeVisible();
  });

  test('should query markets from GraphQL indexer', async ({ page }) => {
    // Navigate to markets page
    await page.goto('http://localhost:3000/markets');
    
    // Wait for markets to load from GraphQL
    await expect(page.locator('text=CLOB Markets')).toBeVisible();
    
    // Check if at least one market is displayed
    await expect(page.locator('text=/0x[a-fA-F0-9]+.*SPOT/')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to trading page and see order book', async ({ page }) => {
    // Navigate to trading page
    await page.goto('http://localhost:3000/trade/WETH-USDC');
    
    // Wait for page to load
    await expect(page.locator('text=WETH/USDC')).toBeVisible();
    
    // Check order book is displayed
    await expect(page.locator('text=Order Book')).toBeVisible();
    
    // Check for order book content or empty state
    const orderBookContent = page.locator('text=No orders in the book yet').or(page.locator('text=Bids'));
    await expect(orderBookContent).toBeVisible({ timeout: 10000 });
  });

  test('should deposit tokens and place an order', async ({ page, context }) => {
    // Navigate to trading page
    await page.goto('http://localhost:3000/trade/WETH-USDC');
    
    // Connect wallet first
    const isConnected = await page.locator(`text=${TEST_ADDRESS.slice(0, 6)}`).isVisible();
    if (!isConnected) {
      await page.click('button:has-text("Connect Wallet")');
      await page.click('button:has-text("Embedded Wallet")');
      await page.fill('input[type="password"]', TEST_PRIVATE_KEY);
      await page.click('button:has-text("Import")');
      await expect(page.locator(`text=${TEST_ADDRESS.slice(0, 6)}...${TEST_ADDRESS.slice(-4)}`)).toBeVisible({ timeout: 10000 });
    }
    
    // Open deposit modal
    await page.click('button:has-text("Deposit")');
    
    // Select USDC and enter amount
    await page.selectOption('select[name="token"]', USDC_ADDRESS);
    await page.fill('input[name="amount"]', '100');
    
    // Click deposit button in modal
    await page.click('button:has-text("Deposit"):not(:disabled)');
    
    // Wait for transaction
    await expect(page.locator('text=Transaction confirmed')).toBeVisible({ timeout: 30000 });
    
    // Close modal
    await page.click('button[aria-label="Close"]');
    
    // Wait for indexer to process the deposit
    await waitForIndexer();
    
    // Now place an order
    await page.click('button:has-text("Buy")');
    await page.fill('input[placeholder="Price"]', '2500');
    await page.fill('input[placeholder="Amount"]', '0.01');
    
    // Submit order
    await page.click('button:has-text("Place Buy Order")');
    
    // Wait for transaction
    await expect(page.locator('text=Order placed successfully')).toBeVisible({ timeout: 30000 });
    
    // Wait for indexer
    await waitForIndexer();
    
    // Check order appears in order book
    await expect(page.locator('text=2500.00')).toBeVisible({ timeout: 10000 });
  });

  test('should see order in user orders and events page', async ({ page }) => {
    // Check user orders section
    await expect(page.locator('text=My Orders')).toBeVisible();
    await expect(page.locator('text=2500.00').nth(1)).toBeVisible(); // Order in my orders section
    
    // Navigate to events page
    await page.goto('http://localhost:3000/events');
    
    // Filter by EnhancedSpotBook
    await page.selectOption('select:has-text("All Contracts")', 'EnhancedSpotBook');
    
    // Check for OrderPlaced event
    await expect(page.locator('text=OrderPlaced')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Type: Buy')).toBeVisible();
    await expect(page.locator('text=Price: 2500000000000000000000')).toBeVisible(); // Price in wei
  });

  test('should cancel order and see updates', async ({ page }) => {
    // Go back to trading page
    await page.goto('http://localhost:3000/trade/WETH-USDC');
    
    // Find and click cancel button for the order
    await page.click('button:has-text("Cancel"):visible');
    
    // Confirm cancellation
    await expect(page.locator('text=Order cancelled successfully')).toBeVisible({ timeout: 30000 });
    
    // Wait for indexer
    await waitForIndexer();
    
    // Check order is removed from order book
    await expect(page.locator('text=No orders in the book yet')).toBeVisible({ timeout: 10000 });
    
    // Check events page for OrderCancelled event
    await page.goto('http://localhost:3000/events');
    await page.selectOption('select:has-text("All Contracts")', 'EnhancedSpotBook');
    await expect(page.locator('text=OrderCancelled')).toBeVisible({ timeout: 10000 });
  });

  test('should show real-time updates when multiple orders are placed', async ({ page, context }) => {
    // Open two browser tabs
    const page2 = await context.newPage();
    
    // Both tabs on trading page
    await page.goto('http://localhost:3000/trade/WETH-USDC');
    await page2.goto('http://localhost:3000/trade/WETH-USDC');
    
    // Place order in first tab
    await page.click('button:has-text("Sell")');
    await page.fill('input[placeholder="Price"]', '3000');
    await page.fill('input[placeholder="Amount"]', '0.01');
    await page.click('button:has-text("Place Sell Order")');
    
    // Wait for confirmation
    await expect(page.locator('text=Order placed successfully')).toBeVisible({ timeout: 30000 });
    
    // Wait for indexer and WebSocket propagation
    await waitForIndexer();
    
    // Check order appears in second tab's order book
    await expect(page2.locator('text=3000.00')).toBeVisible({ timeout: 10000 });
    
    // Clean up
    await page2.close();
  });
});

test.describe('GraphQL API Tests', () => {
  test('should query markets directly from GraphQL', async ({ request }) => {
    const response = await request.post('http://localhost:42069/graphql', {
      data: {
        query: `
          query GetMarkets {
            markets {
              items {
                address
                name
                type
                isActive
              }
            }
          }
        `
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.markets.items).toHaveLength(3); // Should have 3 markets from factory
  });

  test('should query active orders from GraphQL', async ({ request }) => {
    const response = await request.post('http://localhost:42069/graphql', {
      data: {
        query: `
          query GetActiveOrders {
            activeOrders(limit: 10) {
              items {
                orderId
                isBuy
                price
                remainingAmount
              }
            }
          }
        `
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.activeOrders).toBeDefined();
  });
});