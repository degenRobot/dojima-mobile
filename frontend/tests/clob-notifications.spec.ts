import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 60000; // 60 seconds for WebSocket events

// Helper to connect wallet using test seed phrase
async function connectWallet(page: Page) {
  // Click Connect Wallet button
  await page.click('button:has-text("Connect Wallet")');
  
  // Wait for wallet modal
  await page.waitForSelector('text=Shreds Wallet', { timeout: 5000 });
  
  // Click Shreds Wallet option
  await page.click('text=Shreds Wallet');
  
  // Wait for wallet to connect
  await page.waitForSelector('button[aria-label="Account menu"]', { timeout: 10000 });
}

// Helper to deposit tokens
async function depositTokens(page: Page, token: 'WETH' | 'USDC', amount: string) {
  // Navigate to portfolio page
  await page.goto(`${TEST_URL}/portfolio`);
  await page.waitForLoadState('networkidle');
  
  // Open deposit modal
  await page.click('button:has-text("Deposit")');
  
  // Select token if needed
  if (token === 'WETH') {
    await page.click('button[role="tab"]:has-text("WETH")');
  }
  
  // Enter amount
  await page.fill('input[placeholder*="amount"]', amount);
  
  // Click deposit button
  await page.click('button:has-text("Deposit"):not([role="tab"])');
  
  // Wait for transaction
  await page.waitForTimeout(3000);
}

// Helper to check for toast notifications
async function waitForToast(page: Page, text: string, timeout = 10000) {
  const toast = page.locator(`[role="alert"]:has-text("${text}")`);
  await expect(toast).toBeVisible({ timeout });
  return toast;
}

test.describe('CLOB Notification Tests', () => {
  test.setTimeout(TEST_TIMEOUT);
  
  test.beforeEach(async ({ page }) => {
    // Go to home page
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
    
    // Connect wallet
    await connectWallet(page);
    
    // Ensure we have some test tokens
    await depositTokens(page, 'USDC', '1000');
    await depositTokens(page, 'WETH', '1');
  });

  test('should show notification when placing a limit order', async ({ page }) => {
    // Navigate to trade page
    await page.goto(`${TEST_URL}/trade/WETH-USDC`);
    await page.waitForLoadState('networkidle');
    
    // Wait for order form to load
    await page.waitForSelector('text=Place Order', { timeout: 10000 });
    
    // Fill in order details
    await page.fill('input[placeholder*="Price"]', '2000');
    await page.fill('input[placeholder*="Amount"]', '0.1');
    
    // Click Buy button
    await page.click('button:has-text("Buy WETH")');
    
    // Check for order placement notification
    await waitForToast(page, 'Order placed!');
    
    // Verify the notification contains order details
    const toast = await waitForToast(page, 'Buy 0.1');
    await expect(toast).toContainText('$2000');
  });

  test('should show notification when order is matched', async ({ page, context }) => {
    // Open two browser tabs - one for maker, one for taker
    const makerPage = page;
    const takerPage = await context.newPage();
    
    // Connect wallet on taker page
    await takerPage.goto(TEST_URL);
    await connectWallet(takerPage);
    
    // Navigate both to trade page
    await makerPage.goto(`${TEST_URL}/trade/WETH-USDC`);
    await takerPage.goto(`${TEST_URL}/trade/WETH-USDC`);
    await makerPage.waitForLoadState('networkidle');
    await takerPage.waitForLoadState('networkidle');
    
    // Maker places a sell order
    await makerPage.click('button:has-text("Sell")');
    await makerPage.fill('input[placeholder*="Price"]', '2000');
    await makerPage.fill('input[placeholder*="Amount"]', '0.1');
    await makerPage.click('button:has-text("Sell WETH")');
    
    // Wait for order to be placed
    await makerPage.waitForTimeout(2000);
    
    // Taker places a matching buy order
    await takerPage.click('button:has-text("Buy")');
    await takerPage.fill('input[placeholder*="Price"]', '2000');
    await takerPage.fill('input[placeholder*="Amount"]', '0.1');
    await takerPage.click('button:has-text("Buy WETH")');
    
    // Check for order matched notification on maker page
    await waitForToast(makerPage, 'Order matched!', 15000);
    
    // Verify match details
    const makerToast = await waitForToast(makerPage, 'Amount: 0.1');
    await expect(makerToast).toContainText('Price: $2000');
    
    // Also check taker page
    await waitForToast(takerPage, 'Order matched!', 15000);
  });

  test('should show notification when cancelling an order', async ({ page }) => {
    // Navigate to trade page
    await page.goto(`${TEST_URL}/trade/WETH-USDC`);
    await page.waitForLoadState('networkidle');
    
    // Place an order
    await page.fill('input[placeholder*="Price"]', '1500');
    await page.fill('input[placeholder*="Amount"]', '0.05');
    await page.click('button:has-text("Buy WETH")');
    
    // Wait for order to appear in open orders
    await page.waitForTimeout(2000);
    
    // Click on Open Orders tab
    await page.click('button:has-text("Open Orders")');
    
    // Find and cancel the order
    const cancelButton = page.locator('button[aria-label*="Cancel"]').first();
    await cancelButton.click();
    
    // Check for cancellation notification
    await waitForToast(page, 'Order cancelled successfully');
  });

  test('should update open orders in real-time when matched', async ({ page, context }) => {
    // Setup two pages
    const makerPage = page;
    const takerPage = await context.newPage();
    
    await takerPage.goto(TEST_URL);
    await connectWallet(takerPage);
    
    // Navigate to trade pages
    await makerPage.goto(`${TEST_URL}/trade/WETH-USDC`);
    await takerPage.goto(`${TEST_URL}/trade/WETH-USDC`);
    
    // Click on Open Orders tab on maker page
    await makerPage.click('button:has-text("Open Orders")');
    
    // Maker places order
    await makerPage.fill('input[placeholder*="Price"]', '2100');
    await makerPage.fill('input[placeholder*="Amount"]', '0.2');
    await makerPage.click('button:has-text("Sell WETH")');
    
    // Wait for order to appear
    await makerPage.waitForSelector('text=SELL', { timeout: 5000 });
    
    // Verify order is in open orders
    const openOrdersSection = makerPage.locator('[role="tabpanel"]').filter({ has: makerPage.locator('text=SELL') });
    await expect(openOrdersSection).toContainText('0.2');
    await expect(openOrdersSection).toContainText('$2100');
    
    // Taker matches the order
    await takerPage.fill('input[placeholder*="Price"]', '2100');
    await takerPage.fill('input[placeholder*="Amount"]', '0.2');
    await takerPage.click('button:has-text("Buy WETH")');
    
    // Wait for the order to disappear from open orders
    await expect(openOrdersSection.locator('text=SELL')).not.toBeVisible({ timeout: 10000 });
    
    // Verify "Updating orders..." indicator appeared
    await expect(makerPage.locator('text=Updating orders...')).toBeVisible({ timeout: 5000 });
  });

  test('should show multiple notifications for partial fills', async ({ page, context }) => {
    const makerPage = page;
    const takerPage = await context.newPage();
    
    await takerPage.goto(TEST_URL);
    await connectWallet(takerPage);
    
    // Navigate to trade pages
    await makerPage.goto(`${TEST_URL}/trade/WETH-USDC`);
    await takerPage.goto(`${TEST_URL}/trade/WETH-USDC`);
    
    // Maker places large order
    await makerPage.fill('input[placeholder*="Price"]', '2000');
    await makerPage.fill('input[placeholder*="Amount"]', '0.5');
    await makerPage.click('button:has-text("Sell WETH")');
    
    await makerPage.waitForTimeout(2000);
    
    // Taker places first partial fill
    await takerPage.fill('input[placeholder*="Price"]', '2000');
    await takerPage.fill('input[placeholder*="Amount"]', '0.2');
    await takerPage.click('button:has-text("Buy WETH")');
    
    // Check for first match notification
    await waitForToast(makerPage, 'Order matched!');
    await waitForToast(makerPage, 'Amount: 0.2');
    
    // Taker places second partial fill
    await takerPage.waitForTimeout(3000);
    await takerPage.fill('input[placeholder*="Amount"]', '0.3');
    await takerPage.click('button:has-text("Buy WETH")');
    
    // Check for second match notification
    await waitForToast(makerPage, 'Order matched!');
    await waitForToast(makerPage, 'Amount: 0.3');
  });
});