import { test, expect } from '@playwright/test';

test.describe('CLOB Trading Interface - Final Tests', () => {
  test('complete trading interface loads successfully', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Main elements are visible
    await expect(page.locator('text=WETH-USDC').first()).toBeVisible();
    await expect(page.locator('text=Order Book')).toBeVisible();
    await expect(page.locator('text=Market Stats')).toBeVisible();
    await expect(page.locator('text=Recent Trades')).toBeVisible();
    
    // Trading controls
    await expect(page.locator('button:has-text("Buy")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Sell")').first()).toBeVisible();
    
    // Price and amount inputs exist
    await expect(page.locator('text=Price').first()).toBeVisible();
    await expect(page.locator('text=Amount').first()).toBeVisible();
    
    // Bottom tabs
    await expect(page.locator('button:has-text("Balances")')).toBeVisible();
    await expect(page.locator('button:has-text("Open Orders")')).toBeVisible();
  });

  test('order book displays mock data correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Wait for order book section
    const orderBookSection = page.locator('div:has(h3:has-text("Order Book"))').last();
    await expect(orderBookSection).toBeVisible();
    
    // Check spread is displayed
    await expect(orderBookSection.locator('text=Spread:')).toBeVisible();
    
    // Get the order book text content
    const orderBookText = await page.locator('text=/Price.*Amount.*Total/').textContent();
    
    if (orderBookText) {
      // Check that we have price data
      expect(orderBookText).toContain('2800.00'); // Bid price
      expect(orderBookText).toContain('3000.00'); // Ask price
    }
    
    // Check last price
    await expect(page.locator('text=Last Price:')).toBeVisible();
  });

  test('market statistics display correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Market stats section
    const statsSection = page.locator('div:has(h3:has-text("Market Stats"))').last();
    await expect(statsSection).toBeVisible();
    
    // Check stats are displayed
    const statsText = await statsSection.textContent();
    expect(statsText).toContain('24h Volume');
    expect(statsText).toContain('24h High');
    expect(statsText).toContain('24h Low');
    expect(statsText).toContain('$1,234,567'); // Mock volume
  });

  test('can interact with trading form', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Click sell button
    await page.locator('button:has-text("Sell")').first().click();
    
    // Check button text changes
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Buy|Sell/ });
    const buttonText = await submitButton.innerText();
    expect(buttonText).toContain('Sell');
    
    // Check we have price/amount inputs
    const inputs = await page.locator('input[type="number"]').count();
    expect(inputs).toBeGreaterThanOrEqual(2);
  });

  test('bottom panel tabs work correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Test tab switching
    await page.click('button:has-text("Open Orders")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Trade History")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Balances")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
  });

  test('chart controls are present', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Chart type buttons
    await expect(page.locator('button:has-text("Line")')).toBeVisible();
    await expect(page.locator('button:has-text("Candles")')).toBeVisible();
    
    // Time interval buttons
    await expect(page.locator('button:has-text("1m")')).toBeVisible();
    await expect(page.locator('button:has-text("5m")')).toBeVisible();
    await expect(page.locator('button:has-text("1H")')).toBeVisible();
    await expect(page.locator('button:has-text("1D")')).toBeVisible();
  });

  test('recent trades section displays', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Recent trades section
    const tradesSection = page.locator('div:has(h3:has-text("Recent Trades"))').last();
    await expect(tradesSection).toBeVisible();
    
    // Check mock trade data
    const tradesText = await tradesSection.textContent();
    expect(tradesText).toContain('2150.00'); // Price
    expect(tradesText).toContain('12:34:56'); // Time
  });

  test('spread calculation is displayed', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Find spread display
    const spreadText = page.locator('text=/Spread:.*\\d+\\.\\d+.*\\d+\\.\\d+%/');
    await expect(spreadText).toBeVisible();
    
    // Check spread format
    const spread = await spreadText.textContent();
    expect(spread).toMatch(/Spread:.*200\.00.*7\.14%/);
  });
});

test.describe('CLOB GraphQL Integration', () => {
  test('GraphQL endpoint is accessible', async ({ request }) => {
    const response = await request.post('http://localhost:42069/graphql', {
      data: {
        query: `{
          markets {
            items {
              address
              name
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
    expect(json.data).toBeDefined();
  });
});