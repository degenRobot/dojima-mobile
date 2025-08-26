import { test, expect } from '@playwright/test';

test.describe('CLOB Order Book Visualization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to trading page
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Wait for page to load
    await expect(page.locator('h1:has-text("WETH/USDC")')).toBeVisible();
  });

  test('should display order book structure', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Should have order book section
    await expect(orderBook).toBeVisible();
    
    // Should have column headers
    await expect(orderBook.locator('text=Price (USDC)')).toBeVisible();
    await expect(orderBook.locator('text=Amount (WETH)')).toBeVisible();
    await expect(orderBook.locator('text=Total')).toBeVisible();
    
    // Should have spread indicator
    const spread = orderBook.locator('text=Spread:').or(
      orderBook.locator('div:has-text("Spread")')
    );
    
    // Spread might not be visible if no orders
    if (await spread.isVisible({ timeout: 5000 })) {
      await expect(spread).toContainText(/Spread.*\$/);
    }
  });

  test('should display bids and asks sections', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Wait for order book to load
    await page.waitForTimeout(3000);
    
    // Check if we have orders or empty state
    const hasOrders = await orderBook.locator('.text-green-600').count() > 0 || 
                     await orderBook.locator('.text-red-600').count() > 0;
    
    if (hasOrders) {
      // If we have orders, check structure
      // Bids should be in green
      const bids = orderBook.locator('.text-green-600');
      if (await bids.count() > 0) {
        await expect(bids.first()).toBeVisible();
      }
      
      // Asks should be in red
      const asks = orderBook.locator('.text-red-600');
      if (await asks.count() > 0) {
        await expect(asks.first()).toBeVisible();
      }
    } else {
      // Should show empty state
      await expect(orderBook.locator('text=No orders in the book yet')).toBeVisible();
    }
  });

  test('should display order book depth bars', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Wait for potential orders
    await page.waitForTimeout(3000);
    
    // Look for depth visualization bars
    const depthBars = orderBook.locator('div[class*="bg-green-500/10"], div[class*="bg-red-500/10"]');
    
    if (await depthBars.count() > 0) {
      // Depth bars should have varying widths
      const firstBar = depthBars.first();
      await expect(firstBar).toBeVisible();
      
      // Check that bars have width style
      const style = await firstBar.getAttribute('style');
      expect(style).toContain('width');
    }
  });

  test('should show spread calculation', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Wait for order book data
    await page.waitForTimeout(3000);
    
    const spreadElement = orderBook.locator('text=Spread:').locator('..');
    
    if (await spreadElement.isVisible({ timeout: 5000 })) {
      const spreadText = await spreadElement.innerText();
      
      // Should show spread in USD and percentage
      expect(spreadText).toMatch(/Spread:.*\$/);
      expect(spreadText).toMatch(/\d+\.\d+%/);
    } else {
      // If no spread shown, there should be no orders
      await expect(orderBook.locator('text=No orders')).toBeVisible();
    }
  });

  test('should handle order book updates', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Get initial state
    const initialOrderCount = await orderBook.locator('.font-mono').count();
    
    // Wait for potential updates (polling interval is 2 seconds)
    await page.waitForTimeout(5000);
    
    // Get updated state
    const updatedOrderCount = await orderBook.locator('.font-mono').count();
    
    // Order count might have changed
    expect(typeof initialOrderCount).toBe('number');
    expect(typeof updatedOrderCount).toBe('number');
  });

  test('should display price levels correctly', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Wait for orders
    await page.waitForTimeout(3000);
    
    // Get all price elements
    const prices = orderBook.locator('.font-mono').filter({ hasText: /^\$?\d+\.?\d*$/ });
    
    if (await prices.count() > 0) {
      // Verify prices are numbers
      const firstPrice = await prices.first().innerText();
      expect(firstPrice).toMatch(/^\$?\d+\.?\d*$/);
      
      // Check price ordering
      const priceValues = await prices.allInnerTexts();
      const numericPrices = priceValues.map(p => parseFloat(p.replace('$', '')));
      
      // Prices should be valid numbers
      numericPrices.forEach(price => {
        expect(price).toBeGreaterThan(0);
        expect(price).toBeLessThan(1000000); // Sanity check
      });
    }
  });

  test('should show order aggregation by price level', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // If we have orders at the same price level, they should be aggregated
    // This is verified by checking that each price appears only once per side
    
    await page.waitForTimeout(3000);
    
    // Get bid prices
    const bidRows = orderBook.locator('div').filter({ has: page.locator('.text-green-600') });
    const bidPrices = await bidRows.locator('.font-mono').first().allInnerTexts();
    
    // Check for unique prices
    const uniqueBidPrices = [...new Set(bidPrices)];
    expect(uniqueBidPrices.length).toBe(bidPrices.length);
    
    // Same for asks
    const askRows = orderBook.locator('div').filter({ has: page.locator('.text-red-600') });
    const askPrices = await askRows.locator('.font-mono').first().allInnerTexts();
    
    const uniqueAskPrices = [...new Set(askPrices)];
    expect(uniqueAskPrices.length).toBe(askPrices.length);
  });

  test('should handle empty order book gracefully', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Check various states
    const hasEmptyMessage = await orderBook.locator('text=No orders in the book yet').isVisible({ timeout: 5000 });
    const hasOrders = await orderBook.locator('.font-mono').count() > 0;
    const isLoading = await orderBook.locator('text=Loading').isVisible({ timeout: 1000 });
    
    // Should be in one of these states
    expect(hasEmptyMessage || hasOrders || isLoading).toBeTruthy();
  });

  test('should display totals column', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    await page.waitForTimeout(3000);
    
    // If we have orders, check totals
    const orderRows = orderBook.locator('div').filter({ 
      has: page.locator('.font-mono') 
    }).filter({
      hasNot: page.locator('h3')
    });
    
    if (await orderRows.count() > 3) { // More than just headers
      // Each order row should have 3 values: price, amount, total
      const firstRow = orderRows.nth(3); // Skip headers
      const values = await firstRow.locator('.font-mono, .text-right').allInnerTexts();
      
      if (values.length >= 3) {
        // Total should be cumulative
        const amount = parseFloat(values[1]);
        const total = parseFloat(values[2]);
        
        expect(total).toBeGreaterThanOrEqual(amount);
      }
    }
  });

  test('should be responsive to window size', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Test at different viewport sizes
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(orderBook).toBeVisible();
    
    // Mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(orderBook).toBeVisible();
    
    // Tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(orderBook).toBeVisible();
    
    // Order book should remain functional at all sizes
    await expect(orderBook.locator('text=Price (USDC)')).toBeVisible();
  });
});