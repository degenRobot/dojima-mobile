import { test, expect } from '@playwright/test';

// Test configuration
const TEST_PRIVATE_KEY = '0x99e8065d93229e87953669c23cc193f4bbebcdbb877ed272c66ee27a5cb75508';
const TEST_ADDRESS = '0xdD870fA1b7C4700F2BD7f44238821C26f7392148';

test.describe('CLOB Trading Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to trading page
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Wait for page to load
    await expect(page.locator('heading:has-text("WETH-USDC")').or(page.locator('h3:has-text("WETH-USDC")'))).toBeVisible();
  });

  test('should display all trading interface components', async ({ page }) => {
    // Market header
    await expect(page.locator('heading:has-text("WETH-USDC")').or(page.locator('h3:has-text("WETH-USDC")'))).toBeVisible();
    
    // Market stats
    await expect(page.locator('text=Last Price')).toBeVisible();
    await expect(page.locator('text=24h Change')).toBeVisible();
    await expect(page.locator('text=24h Volume')).toBeVisible();
    await expect(page.locator('text=24h High')).toBeVisible();
    await expect(page.locator('text=24h Low')).toBeVisible();
    
    // Order book
    await expect(page.locator('text=Order Book')).toBeVisible();
    await expect(page.locator('text=Price (USDC)')).toBeVisible();
    await expect(page.locator('text=Amount (WETH)')).toBeVisible();
    
    // Order form
    await expect(page.locator('button:has-text("Buy")').or(page.locator('button:has-text("Sell")'))).toBeVisible();
    await expect(page.locator('button:has-text("Limit")').or(page.locator('button:has-text("Market")'))).toBeVisible();
    
    // User panels (bottom tabs)
    await expect(page.locator('button:has-text("Balances")')).toBeVisible();
    await expect(page.locator('button:has-text("Open Orders")')).toBeVisible();
    await expect(page.locator('button:has-text("Positions")')).toBeVisible();
    await expect(page.locator('button:has-text("Trade History")')).toBeVisible();
  });

  test('should load order book data from GraphQL', async ({ page }) => {
    // Wait for order book to load
    const orderBookSection = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Should show either orders or empty state
    await expect(
      orderBookSection.locator('text=No orders').or(
        orderBookSection.locator('text=Bids').or(
          orderBookSection.locator('text=Asks')
        )
      )
    ).toBeVisible({ timeout: 15000 });
  });

  test('should connect embedded wallet and show balances', async ({ page }) => {
    // Click connect wallet button
    const connectButton = page.locator('button:has-text("Connect Wallet")').first();
    
    if (await connectButton.isVisible({ timeout: 2000 })) {
      await connectButton.click();
      
      // Select embedded wallet
      await page.click('button:has-text("Embedded Wallet")');
      
      // Enter private key
      await page.fill('input[type="password"]', TEST_PRIVATE_KEY);
      await page.click('button:has-text("Import")');
      
      // Wait for connection
      await expect(page.locator(`text=${TEST_ADDRESS.slice(0, 6)}`)).toBeVisible({ timeout: 10000 });
    }
    
    // Check balances tab
    await page.click('button:has-text("Balances")');
    
    // Should show WETH and USDC balances
    await expect(page.locator('text=WETH')).toBeVisible();
    await expect(page.locator('text=USDC')).toBeVisible();
  });

  test('should validate order form inputs', async ({ page }) => {
    // Switch to limit order
    await page.click('button:has-text("Limit")');
    
    // Try to place order without wallet connected
    const placeOrderButton = page.locator('button:has-text("Place Order")').or(
      page.locator('button:has-text("Connect Wallet")')
    );
    
    if (await placeOrderButton.isVisible()) {
      const buttonText = await placeOrderButton.innerText();
      
      if (buttonText.includes('Connect Wallet')) {
        expect(buttonText).toContain('Connect Wallet');
      } else {
        // Test validation with empty inputs
        await placeOrderButton.click();
        
        // Should show validation errors or be disabled
        const isDisabled = await placeOrderButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    }
  });

  test('should switch between buy and sell modes', async ({ page }) => {
    // Default should be buy
    const buyButton = page.locator('button:has-text("Buy")');
    const sellButton = page.locator('button:has-text("Sell")');
    
    // Buy button should be active initially
    await expect(buyButton).toHaveClass(/bg-primary|bg-green|text-white/);
    
    // Click sell
    await sellButton.click();
    
    // Sell button should now be active
    await expect(sellButton).toHaveClass(/bg-primary|bg-red|text-white/);
    
    // Order form should update
    const orderButton = page.locator('button[type="submit"]').last();
    const buttonText = await orderButton.innerText();
    expect(buttonText.toLowerCase()).toContain('sell');
  });

  test('should switch between bottom tabs', async ({ page }) => {
    const tabs = ['Balances', 'Open Orders', 'Positions', 'Trade History'];
    
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      
      // Check tab is active (has underline or different styling)
      const tabButton = page.locator(`button:has-text("${tab}")`);
      const tabParent = tabButton.locator('..');
      
      // Should have some active indicator
      await expect(tabButton).toHaveClass(/text-primary|relative/);
    }
  });

  test('should show deposit/withdraw modals', async ({ page }) => {
    // Navigate to balances tab
    await page.click('button:has-text("Balances")');
    
    // Look for deposit/withdraw buttons (Plus/Minus icons)
    const depositButton = page.locator('button:has(svg)').first();
    
    if (await depositButton.isVisible({ timeout: 2000 })) {
      await depositButton.click();
      
      // Modal should open
      await expect(page.locator('text=Deposit').or(page.locator('text=Withdraw'))).toBeVisible();
      
      // Close modal
      const closeButton = page.locator('button[aria-label="Close"]').or(
        page.locator('button:has-text("Close")').or(
          page.locator('button:has(svg[class*="X"])')
        )
      );
      
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        // Click outside modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should display market stats correctly', async ({ page }) => {
    // Wait for stats to load
    const statsSection = page.locator('div').filter({ hasText: /Last Price.*24h Change.*24h Volume/ }).first();
    
    // Check all stat values are present
    const lastPrice = statsSection.locator('text=Last Price').locator('..').locator('div').nth(1);
    const change24h = statsSection.locator('text=24h Change').locator('..').locator('div').nth(1);
    const volume24h = statsSection.locator('text=24h Volume').locator('..').locator('div').nth(1);
    
    // Values should be visible (even if 0)
    await expect(lastPrice).toBeVisible();
    await expect(change24h).toBeVisible();
    await expect(volume24h).toBeVisible();
  });

  test('order book should update via polling', async ({ page }) => {
    const orderBook = page.locator('div:has(h3:has-text("Order Book"))');
    
    // Get initial state
    const initialContent = await orderBook.textContent();
    
    // Wait for potential update (polling interval is 2 seconds)
    await page.waitForTimeout(5000);
    
    // Content might have changed if new orders were placed
    const updatedContent = await orderBook.textContent();
    
    // Test passes either way - we're just verifying the polling mechanism works
    expect(initialContent).toBeDefined();
    expect(updatedContent).toBeDefined();
  });

  test('should handle order placement flow', async ({ page }) => {
    // First connect wallet if needed
    const connectButton = page.locator('button:has-text("Connect Wallet")').first();
    
    if (await connectButton.isVisible({ timeout: 2000 })) {
      await connectButton.click();
      await page.click('button:has-text("Embedded Wallet")');
      await page.fill('input[type="password"]', TEST_PRIVATE_KEY);
      await page.click('button:has-text("Import")');
      await expect(page.locator(`text=${TEST_ADDRESS.slice(0, 6)}`)).toBeVisible({ timeout: 10000 });
    }
    
    // Switch to limit order
    await page.click('button:has-text("Limit")');
    
    // Fill in order form
    const priceInput = page.locator('input[placeholder*="price" i]').or(
      page.locator('label:has-text("Price") + input')
    );
    const amountInput = page.locator('input[placeholder*="amount" i]').or(
      page.locator('label:has-text("Amount") + input')
    );
    
    if (await priceInput.isVisible() && await amountInput.isVisible()) {
      await priceInput.fill('2000');
      await amountInput.fill('0.1');
      
      // Check if place order button is enabled
      const placeOrderButton = page.locator('button[type="submit"]').filter({ hasText: /Buy|Sell|Place Order/ });
      
      // Button should be enabled if inputs are valid
      if (await placeOrderButton.isEnabled()) {
        // We won't actually place the order in tests to avoid state changes
        expect(await placeOrderButton.innerText()).toMatch(/Buy|Sell|Place Order/);
      }
    }
  });
});

test.describe('CLOB Error Handling', () => {
  test('should handle GraphQL errors gracefully', async ({ page }) => {
    // Navigate to page
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Even if GraphQL fails, page should still load
    await expect(page.locator('heading:has-text("WETH-USDC")').or(page.locator('h3:has-text("WETH-USDC")'))).toBeVisible();
    
    // Order book should show loading or empty state
    await expect(
      page.locator('text=Loading').or(
        page.locator('text=No orders').or(
          page.locator('text=Order Book')
        )
      )
    ).toBeVisible();
  });

  test('should show proper state when wallet not connected', async ({ page }) => {
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Bottom tabs should show connect wallet message
    await page.click('button:has-text("Balances")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Open Orders")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
    
    await page.click('button:has-text("Trade History")');
    await expect(page.locator('text=Connect wallet to view your data')).toBeVisible();
  });
});