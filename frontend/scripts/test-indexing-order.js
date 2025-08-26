#!/usr/bin/env node

const { chromium } = require('playwright');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

async function testOrderPlacement() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down actions to see what's happening
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`\n${colors.blue}Testing Order Placement for Indexing${colors.reset}\n`);

    // Navigate to the app
    console.log(`${colors.yellow}1. Loading application${colors.reset}`);
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Go to trade page
    console.log(`${colors.yellow}2. Navigating to Trade page${colors.reset}`);
    await page.click('text=Trade');
    await page.waitForURL('**/trade/**');
    await page.waitForLoadState('networkidle');
    
    // Check if wallet is connected
    const connectButton = await page.locator('button:has-text("Connect Wallet")').isVisible();
    if (connectButton) {
      console.log(`${colors.red}✗ Wallet not connected - please connect wallet manually${colors.reset}`);
      console.log(`${colors.yellow}Waiting for wallet connection...${colors.reset}`);
      
      // Wait for wallet to be connected (user needs to do this manually)
      await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return !buttons.some(btn => btn.textContent?.includes('Connect Wallet'));
      }, { timeout: 60000 });
      
      console.log(`${colors.green}✓ Wallet connected${colors.reset}`);
    }
    
    // Fill in order form
    console.log(`${colors.yellow}3. Filling order form${colors.reset}`);
    
    // Click Buy tab
    await page.click('button[role="tab"]:has-text("Buy")');
    await page.waitForTimeout(500);
    
    // Fill price
    const priceInput = await page.locator('input[placeholder*="Price"]');
    await priceInput.fill('2000');
    console.log(`${colors.green}✓ Price set to 2000${colors.reset}`);
    
    // Fill amount
    const amountInput = await page.locator('input[placeholder*="Amount"]');
    await amountInput.fill('0.01');
    console.log(`${colors.green}✓ Amount set to 0.01${colors.reset}`);
    
    // Wait a moment for form validation
    await page.waitForTimeout(1000);
    
    // Click place order button
    console.log(`${colors.yellow}4. Placing order${colors.reset}`);
    const placeOrderButton = await page.locator('button:has-text("Place Buy Order")');
    
    if (await placeOrderButton.isDisabled()) {
      console.log(`${colors.red}✗ Place order button is disabled${colors.reset}`);
      console.log('Possible reasons:');
      console.log('- Insufficient balance');
      console.log('- No tokens deposited to CLOB');
      console.log('- Form validation failed');
      return;
    }
    
    await placeOrderButton.click();
    
    // Wait for transaction
    console.log(`${colors.yellow}5. Waiting for transaction...${colors.reset}`);
    
    // Look for success toast or transaction confirmation
    const successToast = page.locator('text=/Order placed successfully|Transaction confirmed|Success/i');
    const errorToast = page.locator('text=/Error|Failed|Rejected/i');
    
    const result = await Promise.race([
      successToast.waitFor({ timeout: 30000 }).then(() => 'success'),
      errorToast.waitFor({ timeout: 30000 }).then(() => 'error')
    ]);
    
    if (result === 'success') {
      console.log(`${colors.green}✅ Order placed successfully!${colors.reset}`);
      console.log(`\n${colors.blue}Check the indexer logs to see if the OrderPlaced event was detected${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Order placement failed${colors.reset}`);
      const errorText = await errorToast.textContent();
      console.log(`Error: ${errorText}`);
    }
    
    // Keep browser open for a moment to see the result
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error(`\n${colors.red}Test failed: ${error.message}${colors.reset}\n`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// Run test
testOrderPlacement().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});