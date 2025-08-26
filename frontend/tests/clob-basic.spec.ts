import { test, expect } from '@playwright/test';

// Test configuration
const TEST_PRIVATE_KEY = '0x99e8065d93229e87953669c23cc193f4bbebcdbb877ed272c66ee27a5cb75508';
const TEST_ADDRESS = '0xdD870fA1b7C4700F2BD7f44238821C26f7392148';

test.describe('CLOB Basic Tests', () => {
  test('WebSocket events page should connect and show contracts', async ({ page }) => {
    // Navigate to events page
    await page.goto('http://localhost:3001/events');
    
    // Wait for WebSocket connection
    await expect(page.locator('.bg-green-500')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Connected')).toBeVisible();
    
    // Check contract dropdown has our CLOB contracts
    const contractSelect = page.locator('select').first();
    await expect(contractSelect).toContainText('EnhancedSpotBook');
    await expect(contractSelect).toContainText('SpotFactory');
    
    // Select EnhancedSpotBook
    await contractSelect.selectOption('EnhancedSpotBook');
    
    // Verify contract address is shown
    await expect(page.locator('text=0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222')).toBeVisible();
  });

  test('GraphQL indexer should return markets', async ({ request }) => {
    // Query GraphQL endpoint directly
    const response = await request.post('http://localhost:42069/graphql', {
      data: {
        query: `{
          markets {
            items {
              address
              name
              type
            }
          }
        }`
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    
    // Should have data with markets
    expect(json.data).toBeDefined();
    expect(json.data.markets).toBeDefined();
    expect(json.data.markets.items).toBeInstanceOf(Array);
    
    // Log markets for debugging
    console.log('Markets found:', json.data.markets.items.length);
    json.data.markets.items.forEach((market: any) => {
      console.log(`- ${market.name} (${market.type}) at ${market.address}`);
    });
  });

  test('Trading page should load order book from GraphQL', async ({ page }) => {
    // Navigate to trading page
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Wait for page to load
    await expect(page.locator('h1:has-text("WETH/USDC")')).toBeVisible();
    
    // Check order book section exists
    await expect(page.locator('text=Order Book')).toBeVisible();
    
    // Order book should either show orders or empty state
    const orderBookLoaded = page.locator('text=No orders in the book yet')
      .or(page.locator('text=Bids'))
      .or(page.locator('text=Loading order book'));
    
    await expect(orderBookLoaded).toBeVisible({ timeout: 10000 });
  });

  test('Can connect embedded wallet', async ({ page }) => {
    // Go to portfolio or trading page
    await page.goto('http://localhost:3001/portfolio');
    
    // Look for connect wallet button
    const connectButton = page.locator('button:has-text("Connect Wallet")').first();
    
    if (await connectButton.isVisible()) {
      await connectButton.click();
      
      // Look for embedded wallet option
      await page.click('button:has-text("Embedded Wallet")');
      
      // Enter private key
      await page.fill('input[type="password"]', TEST_PRIVATE_KEY);
      await page.click('button:has-text("Import")');
      
      // Should show connected address
      await expect(page.locator(`text=${TEST_ADDRESS.slice(0, 6)}`)).toBeVisible({ timeout: 10000 });
    }
  });

  test('Real-time event flow test', async ({ page, context }) => {
    // Open events page in one tab
    const eventsPage = page;
    await eventsPage.goto('http://localhost:3001/events');
    
    // Filter to only show EnhancedSpotBook events
    await eventsPage.selectOption('select', 'EnhancedSpotBook');
    
    // Open trading page in another tab
    const tradingPage = await context.newPage();
    await tradingPage.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Note current event count
    const initialEventCount = await eventsPage.locator('.p-3.bg-gray-50').count();
    console.log('Initial event count:', initialEventCount);
    
    // If we can perform an action (deposit/order), check for new events
    // This would require the wallet to be funded
    
    // For now, just verify both pages loaded correctly
    await expect(eventsPage.locator('text=Real-time Event Stream')).toBeVisible();
    await expect(tradingPage.locator('text=Order Book')).toBeVisible();
    
    // Close second tab
    await tradingPage.close();
  });
});