#!/usr/bin/env node

const { chromium } = require('playwright');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper to wait for services
async function waitForServices() {
  console.log(`${colors.blue}Checking if services are running...${colors.reset}`);
  
  try {
    const frontendResponse = await fetch('http://localhost:3000');
    if (!frontendResponse.ok && frontendResponse.status >= 500) {
      throw new Error('Frontend not accessible');
    }
    
    console.log(`${colors.green}✓ Services are running${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Services not running. Please run 'npm run dev:all' first${colors.reset}`);
    return false;
  }
}

// Helper to connect wallet
async function connectWallet(page) {
  console.log(`${colors.cyan}Connecting wallet...${colors.reset}`);
  
  // Click Connect Wallet button
  await page.click('button:has-text("Connect Wallet")');
  
  // Wait for wallet modal
  await page.waitForSelector('text=Shreds Wallet', { timeout: 5000 });
  
  // Click Shreds Wallet option
  await page.click('text=Shreds Wallet');
  
  // Wait for wallet to connect
  await page.waitForSelector('button[aria-label="Account menu"]', { timeout: 10000 });
  
  console.log(`${colors.green}✓ Wallet connected${colors.reset}`);
}

// Helper to check for toast notifications
async function checkForToast(page, expectedText, timeout = 10000) {
  try {
    // Look for toast notifications
    const toast = await page.waitForSelector(`[role="alert"]:has-text("${expectedText}")`, { 
      timeout,
      state: 'visible' 
    });
    
    const fullText = await toast.textContent();
    console.log(`${colors.green}✓ Toast notification found: "${fullText}"${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Toast notification not found: "${expectedText}"${colors.reset}`);
    return false;
  }
}

async function testNotifications() {
  // Check services first
  if (!await waitForServices()) {
    process.exit(1);
  }

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 // Slow down to see actions
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`\n${colors.blue}Starting Notification Tests${colors.reset}\n`);

    // Go to home page and connect wallet
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await connectWallet(page);

    // Test 1: Order Placement Notification
    console.log(`\n${colors.yellow}Test 1: Order Placement Notification${colors.reset}`);
    
    // Navigate to trade page
    await page.click('text=Trade');
    await page.waitForURL('**/trade/**');
    await page.waitForLoadState('networkidle');
    
    // Wait for balances to load
    await page.waitForTimeout(2000);
    
    // Fill in order form
    console.log(`${colors.cyan}Placing a buy order...${colors.reset}`);
    await page.fill('input[placeholder*="Price"]', '2000');
    await page.fill('input[placeholder*="Amount"]', '0.001');
    
    // Click Buy button
    await page.click('button:has-text("Buy WETH")');
    
    // Check for order placement notification
    const placementSuccess = await checkForToast(page, 'Order placed');
    if (!placementSuccess) {
      // Also check for the specific order toast
      await checkForToast(page, 'Buy 0.001');
    }
    
    // Wait a bit before next test
    await page.waitForTimeout(3000);

    // Test 2: Order Cancellation Notification
    console.log(`\n${colors.yellow}Test 2: Order Cancellation Notification${colors.reset}`);
    
    // Click on Open Orders tab
    await page.click('button:has-text("Open Orders")');
    await page.waitForTimeout(1000);
    
    // Check if we have any open orders
    const openOrdersEmpty = await page.locator('text=No open orders').isVisible();
    if (!openOrdersEmpty) {
      console.log(`${colors.cyan}Found open orders, attempting to cancel...${colors.reset}`);
      
      // Find cancel button (X icon)
      const cancelButton = await page.locator('button:has(svg)').filter({ 
        has: page.locator('svg[class*="h-3 w-3"]') 
      }).last();
      
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        // Check for cancellation notification
        await checkForToast(page, 'Order cancelled');
      }
    } else {
      console.log(`${colors.yellow}No open orders to cancel${colors.reset}`);
    }

    // Test 3: Order Matching Notification (requires two browser tabs)
    console.log(`\n${colors.yellow}Test 3: Order Matching Notification${colors.reset}`);
    
    // Open second tab for taker
    const takerPage = await context.newPage();
    await takerPage.goto('http://localhost:3000');
    await connectWallet(takerPage);
    await takerPage.click('text=Trade');
    await takerPage.waitForURL('**/trade/**');
    await takerPage.waitForTimeout(2000);
    
    // Maker places a sell order
    console.log(`${colors.cyan}Maker placing sell order...${colors.reset}`);
    await page.click('button:has-text("Sell")');
    await page.fill('input[placeholder*="Price"]', '2100');
    await page.fill('input[placeholder*="Amount"]', '0.001');
    await page.click('button:has-text("Sell WETH")');
    
    // Wait for order to be placed
    await page.waitForTimeout(2000);
    
    // Taker places matching buy order
    console.log(`${colors.cyan}Taker placing matching buy order...${colors.reset}`);
    await takerPage.click('button:has-text("Buy")');
    await takerPage.fill('input[placeholder*="Price"]', '2100');
    await takerPage.fill('input[placeholder*="Amount"]', '0.001');
    await takerPage.click('button:has-text("Buy WETH")');
    
    // Check for order matched notification on both pages
    console.log(`${colors.cyan}Checking for match notifications...${colors.reset}`);
    const makerMatched = await checkForToast(page, 'Order matched', 15000);
    const takerMatched = await checkForToast(takerPage, 'Order matched', 15000);
    
    if (makerMatched || takerMatched) {
      console.log(`${colors.green}✓ Order matching notifications working!${colors.reset}`);
    }
    
    // Test 4: Check real-time order updates
    console.log(`\n${colors.yellow}Test 4: Real-time Order Updates${colors.reset}`);
    
    // Go to Open Orders tab on maker page
    await page.click('button:has-text("Open Orders")');
    
    // Check for "Updating orders..." text when orders change
    const updatingText = await page.locator('text=Updating orders...').isVisible();
    if (updatingText) {
      console.log(`${colors.green}✓ Real-time order updates indicator working${colors.reset}`);
    }
    
    console.log(`\n${colors.green}✅ Notification tests completed!${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}Test failed: ${error.message}${colors.reset}\n`);
    console.error(error.stack);
  } finally {
    // Keep browser open for a few seconds to see final state
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

// Run tests
testNotifications().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});