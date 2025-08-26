import { test, expect } from '@playwright/test';

test.describe('CLOB Interface Basic Tests', () => {
  test('should load trading page successfully', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Check main elements are present
    await expect(page.locator('text=WETH-USDC').first()).toBeVisible();
    await expect(page.locator('text=Order Book')).toBeVisible();
    await expect(page.locator('text=Market Stats')).toBeVisible();
  });

  test('should display order book with proper structure', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Wait for order book
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))').last();
    await expect(orderBook).toBeVisible();
    
    // Check for spread display
    await expect(orderBook.locator('text=Spread:')).toBeVisible();
    
    // Check for price columns
    await expect(orderBook.locator('text=Price (USDC)')).toBeVisible();
    await expect(orderBook.locator('text=Amount')).toBeVisible();
    await expect(orderBook.locator('text=Total')).toBeVisible();
  });

  test('should have buy/sell toggle buttons', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Check buy/sell buttons exist
    await expect(page.locator('button:has-text("Buy")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Sell")').first()).toBeVisible();
  });

  test('should have order form inputs', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Check for price and amount inputs
    await expect(page.locator('text=Price').first()).toBeVisible();
    await expect(page.locator('text=Amount').first()).toBeVisible();
    await expect(page.locator('spinbutton').first()).toBeVisible();
  });

  test('should display bottom tabs', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Check all tabs are present
    await expect(page.locator('button:has-text("Balances")')).toBeVisible();
    await expect(page.locator('button:has-text("Open Orders")')).toBeVisible();
    await expect(page.locator('button:has-text("Positions")')).toBeVisible();
    await expect(page.locator('button:has-text("Trade History")')).toBeVisible();
  });

  test('should show connect wallet message when not connected', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Click on balances tab
    await page.click('button:has-text("Balances")');
    
    // Should show connect wallet message
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
  });

  test('should display market statistics', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Check market stats section
    const marketStats = page.locator('div:has(h3:has-text("Market Stats"))').last();
    await expect(marketStats).toBeVisible();
    
    // Check for volume, high, low
    await expect(marketStats.locator('text=24h Volume')).toBeVisible();
    await expect(marketStats.locator('text=24h High')).toBeVisible();
    await expect(marketStats.locator('text=24h Low')).toBeVisible();
  });

  test('should have chart type toggle', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Check for chart type buttons
    await expect(page.locator('button:has-text("Line")')).toBeVisible();
    await expect(page.locator('button:has-text("Candles")')).toBeVisible();
  });

  test('order book displays actual orders', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Wait for order book to load
    await page.waitForTimeout(3000);
    
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))').last();
    
    // Check if we have order data
    const orderText = await orderBook.textContent();
    
    // Should have price levels
    expect(orderText).toContain('2800.00'); // Bid price
    expect(orderText).toContain('3000.00'); // Ask price
    
    // Should show last price
    expect(orderText).toContain('Last Price:');
  });

  test('can switch between tabs', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Click through tabs
    await page.click('button:has-text("Open Orders")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Trade History")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Positions")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Balances")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
  });
});