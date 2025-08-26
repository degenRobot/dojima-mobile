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

async function waitForServices() {
  console.log(`${colors.blue}Checking if services are running...${colors.reset}`);
  
  try {
    // Check frontend
    const frontendResponse = await fetch('http://localhost:3001');
    if (!frontendResponse.ok && frontendResponse.status >= 500) {
      throw new Error('Frontend not accessible');
    }
    
    // Check indexer
    const indexerResponse = await fetch('http://localhost:42069/status');
    if (!indexerResponse.ok && indexerResponse.status >= 500) {
      throw new Error('Indexer not accessible');
    }
    
    console.log(`${colors.green}✓ Services are running${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Services not running. Please run 'npm run dev:all' first${colors.reset}`);
    return false;
  }
}

async function testUI() {
  // Check services first
  if (!await waitForServices()) {
    process.exit(1);
  }

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down actions to see what's happening
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`\n${colors.blue}Starting UI Tests${colors.reset}\n`);

    // Test 1: Landing page
    console.log(`${colors.yellow}Test 1: Landing Page${colors.reset}`);
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    console.log(`${colors.green}✓ Landing page loaded${colors.reset}`);
    
    // Test 2: Navigate to Trade page
    console.log(`\n${colors.yellow}Test 2: Trade Page${colors.reset}`);
    await page.click('text=Trade');
    await page.waitForURL('**/trade/**');
    await page.waitForLoadState('networkidle');
    console.log(`${colors.green}✓ Trade page loaded${colors.reset}`);
    
    // Check that limit orders are the only option
    const limitOrderText = await page.locator('text=Limit Orders Only').isVisible();
    if (limitOrderText) {
      console.log(`${colors.green}✓ Limit orders only - market orders removed${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Could not find "Limit Orders Only" text${colors.reset}`);
    }
    
    // Check price input is visible
    const priceInput = await page.locator('label:has-text("Price")').isVisible();
    if (priceInput) {
      console.log(`${colors.green}✓ Price input is visible${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Price input not found${colors.reset}`);
    }
    
    // Test 3: Check deposit/withdraw buttons in balance section
    console.log(`\n${colors.yellow}Test 3: Deposit/Withdraw Buttons${colors.reset}`);
    
    // Look for the + and - buttons next to balances
    const depositButtons = await page.locator('[title="Deposit"], button:has(svg[class*="h-3 w-3"]) >> nth=0').count();
    const withdrawButtons = await page.locator('[title="Withdraw"], button:has(svg[class*="h-3 w-3"]) >> nth=1').count();
    
    if (depositButtons > 0 || withdrawButtons > 0) {
      console.log(`${colors.green}✓ Found deposit/withdraw buttons in balance section${colors.reset}`);
      
      // Try clicking a deposit button to open modal
      const plusButton = await page.locator('button:has(svg[class*="h-3 w-3"])').first();
      await plusButton.click();
      
      // Wait for modal
      const modalTitle = await page.locator('text=Manage Funds').isVisible();
      if (modalTitle) {
        console.log(`${colors.green}✓ Deposit/Withdraw modal opens${colors.reset}`);
        
        // Check tabs
        const depositTab = await page.locator('button[role="tab"]:has-text("Deposit")').isVisible();
        const withdrawTab = await page.locator('button[role="tab"]:has-text("Withdraw")').isVisible();
        
        if (depositTab && withdrawTab) {
          console.log(`${colors.green}✓ Modal has Deposit and Withdraw tabs${colors.reset}`);
        }
        
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      console.log(`${colors.red}✗ Deposit/withdraw buttons not found${colors.reset}`);
    }
    
    // Test 4: Navigate to Portfolio page
    console.log(`\n${colors.yellow}Test 4: Portfolio Page${colors.reset}`);
    await page.click('text=Portfolio');
    await page.waitForURL('**/portfolio');
    await page.waitForLoadState('networkidle');
    console.log(`${colors.green}✓ Portfolio page loaded${colors.reset}`);
    
    // Check quick actions
    const quickActionsCard = await page.locator('text=Quick Actions').isVisible();
    if (quickActionsCard) {
      console.log(`${colors.green}✓ Quick Actions section found${colors.reset}`);
      
      // Test deposit button
      const depositButton = await page.locator('button:has-text("Deposit")').first();
      if (await depositButton.isVisible()) {
        await depositButton.click();
        
        const modal = await page.locator('text=Manage Funds').isVisible();
        if (modal) {
          console.log(`${colors.green}✓ Deposit button opens modal${colors.reset}`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }
    
    // Test 5: Check Markets page
    console.log(`\n${colors.yellow}Test 5: Markets Page${colors.reset}`);
    await page.click('text=Markets');
    await page.waitForURL('**/markets');
    await page.waitForLoadState('networkidle');
    console.log(`${colors.green}✓ Markets page loaded${colors.reset}`);
    
    // Check if WETH-USDC market is shown
    const wethUsdcMarket = await page.locator('text=WETH-USDC').isVisible();
    if (wethUsdcMarket) {
      console.log(`${colors.green}✓ WETH-USDC market displayed${colors.reset}`);
    }
    
    console.log(`\n${colors.green}✅ All UI tests completed!${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}Test failed: ${error.message}${colors.reset}\n`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// Run tests
testUI().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});